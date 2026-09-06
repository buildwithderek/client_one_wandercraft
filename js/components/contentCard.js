/**
 * One content (video/short/stream/BTS) card. Stagger animation is applied
 * via CSS variable so the parent module can reflow without recomputing
 * inline animationDelay strings.
 */

import { CONTENT_BADGES } from '../data/content.js';
import { ICONS } from './icons.js';
import { escapeHtml, escapeUrl, escapeColor } from '../utils/escape.js';

export function contentCardHTML(item, index = 0) {
  const badge = CONTENT_BADGES[item.type] || { className: 'badge-video', label: 'Video' };

  // Real feed items carry a link (YouTube watch URL) and a thumbnail; the
  // static demo items don't. Cards with a link render as an anchor so the
  // whole card clicks through; the gradient stays underneath the thumbnail
  // as the loading/error fallback.
  // Everything below comes from data/videos.json, which is scraped from
  // third-party YouTube feeds and auto-committed — treat it as untrusted.
  const href = escapeUrl(item.link);
  const tag = href ? 'a' : 'div';
  const linkAttrs = href
    ? ` href="${href}" target="_blank" rel="noopener noreferrer"`
    : '';
  const thumbSrc = escapeUrl(item.thumbnail);
  const thumbImg = thumbSrc
    ? `<img class="content-thumb-img" src="${thumbSrc}" alt="" loading="lazy" onerror="this.remove()">`
    : '';

  return `
    <${tag} class="content-card"${linkAttrs}
         data-id="${escapeHtml(item.id)}"
         data-type="${escapeHtml(item.type)}"
         data-creator="${escapeHtml(item.creator)}"
         data-views="${escapeHtml(item.views)}"
         style="animation-delay: ${(index * 0.08).toFixed(2)}s">
      <div class="content-thumb">
        <div class="content-thumb-bg"
             style="background: linear-gradient(135deg, ${escapeColor(item.color)}, ${escapeColor(item.color)}88)">WC</div>
        ${thumbImg}
        <div class="content-thumb-overlay">
          <div class="play-btn" aria-hidden="true">${ICONS.play(22)}</div>
        </div>
        <span class="content-badge ${badge.className}">${badge.label}</span>
        ${item.duration ? `<span class="content-duration">${escapeHtml(item.duration)}</span>` : ''}
      </div>
      <div class="content-meta">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="content-meta-row">
          <span class="content-creator-name">${escapeHtml(item.creator)}</span>
          <span class="content-views-date">${escapeHtml([item.views, item.date].filter(Boolean).join(' · '))}</span>
        </div>
      </div>
    </${tag}>
  `;
}
