/**
 * HTML escaping for values that end up inside template-literal markup.
 *
 * Most card data on the site is authored in js/data/*.js and is therefore
 * trusted. The Content Dashboard is the exception: js/data/videos.json is
 * scraped from creators' public YouTube feeds by scripts/build-youtube-feed.mjs
 * and committed straight to the repo by a scheduled Action. Nobody reviews it
 * in between, so a video title is attacker-controlled input as far as this
 * site is concerned — escape it before it reaches innerHTML.
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape text or an attribute value for interpolation into HTML.
 * Null and undefined become an empty string so callers don't render "undefined".
 */
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}

/**
 * Escape a URL for an href/src attribute, rejecting any scheme that can execute
 * script. Only absolute http(s), protocol-relative, and site-relative paths get
 * through; anything else returns '' so the caller can omit the attribute.
 */
export function escapeUrl(value) {
  if (value == null) return '';
  // Strip control characters and spaces first — "java\tscript:" is still javascript:.
  const normalized = String(value).replace(/[\u0000-\u0020]/g, '');
  const allowed = /^(?:https?:)?\/\//i.test(normalized) || /^\/(?!\/)/.test(normalized);
  return allowed ? escapeHtml(normalized) : '';
}

/**
 * Escape a value destined for a style attribute. Only simple colour tokens get
 * through — a hex colour, rgb()/rgba(), or a bare CSS keyword — because
 * anything else in a style attribute is a CSS-injection surface.
 */
export function escapeColor(value, fallback = '#29ABE2') {
  if (value == null) return fallback;
  const raw = String(value).trim();
  const safe = /^#[0-9a-f]{3,8}$/i.test(raw)
    || /^rgba?\(\s*[\d.\s,%]+\)$/i.test(raw)
    || /^[a-z]+$/i.test(raw);
  return safe ? raw : fallback;
}
