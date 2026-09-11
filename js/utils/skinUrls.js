/**
 * Minecraft skin renderer URLs.
 *
 * The hero cards use a true 3D full-body render (nmsr.nickac.dev — NickAc's
 * Minecraft Skin Renderer). It's fast, renders the second/overlay layer with
 * real depth, accepts a plain username, and has been far more reliable than
 * starlightskins.lunareclipse.studio (which had repeated multi-hour 502s).
 *
 * If the 3D render doesn't come back in time, the loader falls back to a flat
 * 2D body from minotar.net. See skinFallbackChain() and setupSkinLoaders() in
 * components/creatorCard.js.
 *
 * Renders are addressed by the skin's texture hash where js/data/skins.js has
 * one (see skinIdentity below for why), and by username otherwise. The 2D
 * fallbacks are always username-based — they don't accept hashes.
 */

const NMSR_BASE      = 'https://nmsr.nickac.dev';
const MINOTAR_BASE   = 'https://minotar.net';

/**
 * 3D full-body render (the primary, "hero" look).
 *
 * `mode` is an NMSR render type:
 *   - 'fullbody'    front-facing 3D body (default card render)
 *   - 'fullbodyiso' isometric 3/4 angle (used for the hover swap)
 * See https://nmsr.nickac.dev for the full list. An unknown mode would 404,
 * so callers should stick to the two above.
 */
export function fullBodySkinUrl(identity, { mode = 'fullbody' } = {}) {
  if (!identity) return '';
  return `${NMSR_BASE}/${mode}/${encodeURIComponent(identity)}`;
}

/**
 * What to address the 3D render by: a skin's texture hash when js/data/skins.js
 * has one, otherwise the username.
 *
 * The hash matters because the card fetches TWO renders of the same person —
 * front-facing, and isometric for the hover. NMSR caches per (mode, identity)
 * and those caches expire independently, so a username-addressed card could
 * serve a creator's new skin on the card and their old one on hover. A hash
 * names one exact image forever, so both modes are guaranteed to agree and a
 * stale render is impossible.
 *
 * scripts/build-skin-map.mjs refreshes the map daily. Anyone missing from it
 * falls back to the username and simply keeps the old behaviour.
 */
export function skinIdentity(creator, skinMap = {}) {
  return skinMap[creator?.id]?.texture || creator?.mcUsername || '';
}

/**
 * Front-facing flat 2D body from minotar.net — the fallback when the 3D render
 * is slow or down. It returns real PNG bytes for every IGN on the roster,
 * which is why it is the one we kept. `size` is the render width in px;
 * pixelated rendering keeps it crisp.
 */
export function minotarBodyUrl(username, size = 300) {
  if (!username) return '';
  return `${MINOTAR_BASE}/body/${encodeURIComponent(username)}/${size}.png`;
}

/**
 * Flat 2D fallback renderers, tried in turn when the 3D render fails or
 * stalls. setupSkinLoaders() walks this chain on each <img> error/timeout.
 *
 * mc-heads.net used to sit at the end of this chain and was removed: it does
 * not serve these players' skins at all, it serves default Steve. A fallback
 * that renders the wrong person is worse than no fallback — the card's own
 * placeholder is honest about not having the image, a stranger's skin is not.
 * The chain is deliberately allowed to be one entry long.
 */
export function skinFallbackChain(username) {
  if (!username) return [];
  return [minotarBodyUrl(username)];
}
