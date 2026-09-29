/**
 * One masonry tile in the fan-art gallery.
 *
 * Two render modes:
 *   - `item.image` set → render an <img> with the colored placeholder
 *     behind it. If the image fails to load (404, broken path), the
 *     onerror handler hides the <img> so the placeholder shows through
 *     instead of a broken-image icon.
 *   - no image → just the gradient placeholder block.
 *
 * Either way the tile's box is reserved before the image loads — from the
 * artwork's own aspect ratio where we have it — so the masonry layout does
 * not depend on the image arriving, and nothing shifts when it does.
 */

import { ICONS } from './icons.js';

export function fanArtItemHTML(item) {
  const hasImage = !!item.image;

  // Inline <img> only renders when we have a path. If it errors we hide
  // the img and the colored placeholder underneath stays visible.
  const imageMarkup = hasImage
    ? `<img class="fanart-image"
           src="${item.image}"
           alt="${escapeAttr(item.title)} by ${escapeAttr(item.artist)}"
           ${item.width && item.height ? `width="${item.width}" height="${item.height}"` : ''}
           loading="lazy"
           onerror="this.style.display='none'">`
    : '';

  // Shape the tile to the artwork. Every tile used to be a hard-coded pixel
  // height, so object-fit: cover trimmed whatever did not fit — the contest
  // winner lost nearly a third of its width. Giving the box the image's own
  // ratio means cover has nothing left to cut.
  //
  // Items with no dimensions keep the old fixed-height behaviour, so a piece
  // added without them still renders.
  const sizing = item.width && item.height
    ? `aspect-ratio: ${item.width} / ${item.height};`
    : `height: ${item.height}px;`;

  return `
    <div class="fanart-item reveal"
         data-id="${item.id}"
         data-type="${item.type}"
         data-likes="${item.likes}">
      <div class="fanart-placeholder"
           style="${sizing}
                  background: linear-gradient(135deg, ${item.color}33, ${item.color}11);
                  border: 1px solid ${item.color}44;">
        <div class="fanart-placeholder-block" style="background: ${item.color}"></div>
        ${imageMarkup}
        <button type="button"
                class="fanart-likes"
                data-id="${item.id}"
                data-base-likes="${item.likes}"
                aria-pressed="false"
                aria-label="Like ${escapeAttr(item.title)} by ${escapeAttr(item.artist)}">
          ${ICONS.heart(14)}
          <span class="fanart-like-count">${item.likes.toLocaleString()}</span>
        </button>
      </div>
      <div class="fanart-overlay">
        <h4>${item.title}</h4>
        <p>by ${item.artist}</p>
      </div>
    </div>
  `;
}

/** Tiny HTML-attribute escape so titles with quotes don't break the markup. */
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
