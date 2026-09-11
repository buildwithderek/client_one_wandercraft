/**
 * Single registry for every inline SVG used in the UI.
 *
 * Why a registry: the original index.html had the same YouTube/TikTok/Twitch/
 * Instagram path data inlined four times (once per creator card), plus extra
 * copies for the footer and creator pin popups. One place to fix when a logo
 * mark updates.
 *
 * Each entry is a pure function that returns an SVG string. Components that
 * want a real Node should wrap with `parseSvg(html)` from this file.
 */

const ariaHidden = 'aria-hidden="true" focusable="false"';

export const ICONS = {
  pin: (size = 14) =>
    `<svg ${ariaHidden} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,

  play: (size = 22) =>
    `<svg ${ariaHidden} width="${size}" height="${size}" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,

  heart: (size = 12) =>
    `<svg ${ariaHidden} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,

  upload: (size = 48) =>
    `<svg ${ariaHidden} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,

  compass: (size = 20) =>
    `<svg ${ariaHidden} width="${size}" height="${size}" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/></svg>`,

  // Brand logo for header/footer.
  // `size` is the rendered HEIGHT in pixels; width auto-scales so the
  // ~1.2:1 PNG keeps its aspect ratio. Returns an <img>, not an SVG —
  // the file is a raster, so SVG wrapping just risked distortion.
  brand: (size = 32) =>
    `<img class="logo-icon" src="assets/logo/wandercraft.png" alt="" ${ariaHidden} style="height:${size}px;width:auto;">`,
};

/**
 * Social platform icons. Keys match `socialPlatforms` entries in creators.js.
 * `cssClass` is the modifier that style.css uses to color each one.
 */
export const SOCIAL_ICONS = {
  youtube: {
    label: 'YouTube',
    cssClass: 'yt',
    svg: `<svg ${ariaHidden} viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>`,
  },
  tiktok: {
    label: 'TikTok',
    cssClass: 'tt',
    svg: `<svg ${ariaHidden} viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.92a8.25 8.25 0 004.77 1.5V7.03a4.84 4.84 0 01-1-.34z"/></svg>`,
  },
  twitch: {
    label: 'Twitch',
    cssClass: 'tw',
    svg: `<svg ${ariaHidden} viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M4.5 1L2.07 6v15.14h5.36V24h3.21l3.07-2.86h4.64L23.57 16V1m-1.79 13.71l-3.57 3.57h-5.36l-3.07 2.86v-2.86H5.36V2.79h16.43"/></svg>`,
  },
  discord: {
    label: 'Discord',
    cssClass: 'dc',
    svg: `<svg ${ariaHidden} viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  },
  instagram: {
    label: 'Instagram',
    cssClass: 'ig',
    svg: `<svg ${ariaHidden} viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85 0 3.2-.01 3.58-.07 4.85-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07-3.2 0-3.58-.01-4.85-.07-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85 0-3.2.01-3.58.07-4.85C2.38 3.86 3.9 2.31 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1018.16 12 6.16 6.16 0 0012 5.84zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>`,
  },
};
