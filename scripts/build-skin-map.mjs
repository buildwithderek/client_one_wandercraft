/**
 * WanderCraft — creator skin map
 * ==============================
 *
 * Resolves every creator's CURRENT Minecraft skin to its immutable texture
 * hash and writes js/data/skins.js.
 *
 * Why this exists
 * ---------------
 * The card renders a creator twice: a front-facing body, and an isometric
 * version swapped in on hover. Both used to be addressed by username:
 *
 *     nmsr.nickac.dev/fullbody/MossyMads
 *     nmsr.nickac.dev/fullbodyiso/MossyMads
 *
 * The renderer caches per (mode, username), and those two caches expire
 * independently. So for a while after a creator changes their skin, one URL
 * serves the new skin and the other still serves the old one — the card shows
 * one person and the hover shows another. Observed live on more than one
 * creator, which is what prompted this.
 *
 * A texture hash names one exact skin image forever, so both modes addressed
 * by hash are guaranteed to be the same skin, and a stale cache is impossible:
 * a changed skin is a different hash, which is a different URL.
 *
 * The trade is that a hash has to be refreshed when someone changes their
 * skin, which is what the daily .github/workflows/refresh-skins.yml does.
 * Between runs the site is at most a day behind, and the frontend falls back
 * to username addressing for anyone missing from the map — so a creator added
 * between runs still renders, just with the old incoherence until the next
 * refresh.
 *
 * Run locally:  node scripts/build-skin-map.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = resolve(REPO_ROOT, 'js', 'data', 'skins.js');

const MOJANG_PROFILE = 'https://api.mojang.com/users/profiles/minecraft/';
const MOJANG_SESSION = 'https://sessionserver.mojang.com/session/minecraft/profile/';

/** Mojang rate-limits hard; go gently rather than in parallel. */
const GAP_MS = 250;

async function main() {
  const { CREATORS } = await import(`file://${resolve(REPO_ROOT, 'js/data/creators.js')}`);
  const named = CREATORS.filter((c) => c.mcUsername);

  console.log(`[build-skin-map] Resolving skins for ${named.length} creator(s)...`);

  const map = {};
  const failures = [];

  for (const creator of named) {
    try {
      const entry = await resolveSkin(creator.mcUsername);
      map[creator.id] = entry;
      console.log(`  ${creator.name} (${creator.mcUsername}) -> ${entry.texture.slice(0, 12)}… ${entry.model}`);
    } catch (err) {
      failures.push(creator.name);
      console.warn(`  ${creator.name} (${creator.mcUsername}) FAILED: ${err.message}`);
    }
    await sleep(GAP_MS);
  }

  // A run that resolved nothing is a Mojang outage, not a roster of ghosts —
  // never overwrite a good map with an empty one.
  if (Object.keys(map).length === 0) {
    throw new Error('Resolved zero skins — refusing to write an empty map.');
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, renderModule(map));

  console.log(`[build-skin-map] Wrote ${Object.keys(map).length} skin(s)`
    + (failures.length ? `, ${failures.length} unresolved (${failures.join(', ')})` : ''));

  if (failures.length) {
    console.log(`::warning::Could not resolve skins for: ${failures.join(', ')}. `
      + 'Those cards fall back to username addressing.');
  }
}

/** username -> { uuid, texture, model } using Mojang's public profile APIs. */
async function resolveSkin(username) {
  const profile = await getJson(MOJANG_PROFILE + encodeURIComponent(username));
  if (!profile?.id) throw new Error('no such Minecraft account');

  const session = await getJson(MOJANG_SESSION + profile.id);
  const prop = (session?.properties || []).find((p) => p.name === 'textures');
  if (!prop) throw new Error('profile carries no textures');

  const decoded = JSON.parse(Buffer.from(prop.value, 'base64').toString('utf8'));
  const skin = decoded?.textures?.SKIN;
  if (!skin?.url) throw new Error('profile has no skin texture');

  // The trailing path segment of the texture URL is the immutable hash.
  const texture = skin.url.split('/').pop();
  if (!/^[a-f0-9]{32,64}$/i.test(texture)) throw new Error(`unexpected texture url: ${skin.url}`);

  return {
    uuid: profile.id,
    texture,
    model: skin.metadata?.model === 'slim' ? 'slim' : 'classic',
  };
}

/**
 * Emit a plain ES module rather than JSON so creatorCard.js can import it
 * synchronously — a card is built in one pass and has nothing to await on.
 */
function renderModule(map) {
  const entries = Object.entries(map)
    .map(([id, v]) => `  '${id}': { texture: '${v.texture}', model: '${v.model}' },`)
    .join('\n');
  return `/**
 * GENERATED FILE — do not edit by hand.
 * Written by scripts/build-skin-map.mjs, refreshed daily by
 * .github/workflows/refresh-skins.yml.
 *
 * Maps a creator id to the immutable hash of their current Minecraft skin.
 * Addressing renders by hash instead of username is what keeps a card and its
 * hover showing the same skin — see the script's docblock for why that was
 * not true before.
 *
 * A creator missing from this map still renders: skinUrls.js falls back to
 * addressing by username.
 */

export const SKIN_MAP = {
${entries}
};
`;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'wandercraft-site/skin-map' } });
  if (res.status === 429) throw new Error('rate limited by Mojang');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

main().catch((err) => {
  console.error('[build-skin-map] FATAL:', err.message);
  process.exit(1);
});
