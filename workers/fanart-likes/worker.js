/**
 * WanderCraft — fan-art likes
 * ===========================
 *
 * Shared like counts for the fan-art gallery. Before this existed a like was
 * written to the visitor's own localStorage, so it survived a reload but was
 * invisible to everybody else and every count on the site read zero.
 *
 * Endpoints
 *   GET  /likes            -> { "fan-art-1": 12, ... }   counts for every item
 *   POST /likes            -> { id, count, liked }       toggle one item
 *        body: { "id": "fan-art-1", "liked": true, "visitor": "<uuid>" }
 *
 * Storage (KV)
 *   count:<itemId>              total likes, as a decimal string
 *   vote:<itemId>:<visitorId>   presence means this visitor currently likes it
 *
 * On identity: `visitor` is a random UUID the browser generates and keeps in
 * localStorage. It is not an account and it is forgeable — someone determined
 * can mint new ids and like repeatedly. That is the honest trade for a counter
 * with no login: the visitor id stops ordinary double-counting (reloads, a
 * second tab, clicking twice), and the per-IP rate limit below is what stops
 * scripted inflation. Nothing here is worth protecting more heavily than that.
 *
 * On accuracy: KV is eventually consistent and a count is read-modify-write,
 * so two likes landing in the same instant can collapse into one. For fan-art
 * hearts that is an acceptable trade for staying on KV rather than taking on
 * Durable Objects.
 */

const ALLOWED_ORIGINS = new Set([
  'https://playwandercraft.com',
  'https://www.playwandercraft.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

/** Write budget per IP per minute. Reading is not limited. */
const WRITES_PER_MINUTE = 20;

/** Ceiling on a single item's count, so a runaway loop cannot print nonsense. */
const MAX_COUNT = 1_000_000;

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const VISITOR_RE = /^[a-f0-9-]{8,64}$/i;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/likes') return json({ error: 'Not found' }, 404, cors);

    // Writes must come from a known origin; a GET is public data either way.
    if (request.method === 'POST' && !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: 'Origin not allowed' }, 403, cors);
    }

    try {
      if (request.method === 'GET') return json(await readAll(env), 200, cors, 15);
      if (request.method === 'POST') return await toggle(request, env, cors);
    } catch (err) {
      return json({ error: 'Upstream storage error', detail: String(err?.message || err) }, 502, cors);
    }
    return json({ error: 'Method not allowed' }, 405, cors);
  },
};

/* ---------- handlers ---------- */

async function readAll(env) {
  const out = {};
  let cursor;
  do {
    const page = await env.FANART_LIKES.list({ prefix: 'count:', cursor });
    // Fetch this page's values together rather than serially.
    const values = await Promise.all(page.keys.map((k) => env.FANART_LIKES.get(k.name)));
    page.keys.forEach((k, i) => {
      out[k.name.slice('count:'.length)] = Number(values[i]) || 0;
    });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

async function toggle(request, env, cors) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Body must be JSON' }, 400, cors); }

  const { id, visitor } = body || {};
  const liked = body?.liked !== false; // default to liking

  if (!ID_RE.test(id || '')) return json({ error: 'Invalid item id' }, 400, cors);
  if (!VISITOR_RE.test(visitor || '')) return json({ error: 'Invalid visitor id' }, 400, cors);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await isRateLimited(env, ip)) {
    return json({ error: 'Slow down' }, 429, { ...cors, 'Retry-After': '60' });
  }

  const voteKey = `vote:${id}:${visitor}`;
  const countKey = `count:${id}`;
  const already = (await env.FANART_LIKES.get(voteKey)) !== null;

  // Already in the requested state — report the count without touching it.
  if (already === liked) {
    return json({ id, liked, count: Number(await env.FANART_LIKES.get(countKey)) || 0 }, 200, cors);
  }

  const current = Number(await env.FANART_LIKES.get(countKey)) || 0;
  const next = Math.max(0, Math.min(MAX_COUNT, current + (liked ? 1 : -1)));

  if (liked) await env.FANART_LIKES.put(voteKey, '1');
  else await env.FANART_LIKES.delete(voteKey);
  await env.FANART_LIKES.put(countKey, String(next));

  return json({ id, liked, count: next }, 200, cors);
}

/* ---------- helpers ---------- */

async function isRateLimited(env, ip) {
  const key = `rl:${ip}:${Math.floor(Date.now() / 60_000)}`;
  const used = Number(await env.FANART_LIKES.get(key)) || 0;
  if (used >= WRITES_PER_MINUTE) return true;
  // expirationTtl has a 60s floor in KV, which is exactly one window.
  await env.FANART_LIKES.put(key, String(used + 1), { expirationTtl: 60 });
  return false;
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  // Echo the origin only when we know it — no wildcard.
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(data, status, headers = {}, cacheSeconds = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
      ...headers,
    },
  });
}
