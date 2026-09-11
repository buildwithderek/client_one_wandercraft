/**
 * One creator card — playwandercraft.com/creators layout.
 *
 * Layout: full-body Minecraft skin render on top, name (H2), role in small
 * caps below. A 🔴 LIVE badge appears in the top-right corner when the
 * creator is streaming (driven by liveStatus.js).
 *
 * The skin URL is auto-generated from the creator's Minecraft username via
 * nmsr.nickac.dev (a true 3D render). On hover, the image swaps to the
 * isometric 3/4 angle of the same skin — the swap is wired by
 * initializeSkinHoverEffects(), which modules/creators.js calls after
 * rendering the grid.
 */

import { fullBodySkinUrl, skinFallbackChain } from '../utils/skinUrls.js';
import { ROLE_VARIANTS } from '../data/creators.js';
import {
  twitchUrlFor,
  youtubeUrlFor,
  youtubeLiveUrlFor,
  tiktokUrlFor,
  tiktokLiveUrlFor,
  instagramUrlFor,
} from '../data/links.js';
import { SOCIAL_ICONS } from './icons.js';

/**
 * Per-platform pill row shown in the top-right of each card image.
 *
 * Each pill is a link to the creator's channel on that platform. While
 * the creator is offline the pill is muted/subtle; when liveStatus reports
 * them live, modules/creators.js adds `.is-live`, which switches the link
 * to the platform's /live URL and unhides the LIVE dot.
 *
 * Hooks for the dashboard layer:
 *   data-platform="twitch|youtube|tiktok"
 *   data-live-for="<creatorId>"
 *
 * Instagram and Discord are `live: false` — neither has a broadcast state,
 * so they render as plain profile links with no live hooks and liveStatus
 * never touches them.
 *
 * Only platforms with a handle on this creator are rendered. A creator
 * with only a Twitch handle gets one pill; a creator on every platform
 * gets five.
 */
function renderPlatformPills(creator) {
  const entries = [
    {
      key: 'twitch',
      handle: creator.twitchUsername,
      profileHref: creator.twitchUsername && twitchUrlFor(creator.twitchUsername),
      liveHref: creator.twitchUsername && twitchUrlFor(creator.twitchUsername),
    },
    {
      key: 'youtube',
      handle: creator.youtubeHandle,
      profileHref: creator.youtubeHandle && youtubeUrlFor(creator.youtubeHandle),
      liveHref: creator.youtubeHandle && youtubeLiveUrlFor(creator.youtubeHandle),
    },
    {
      key: 'tiktok',
      handle: creator.tiktokHandle,
      profileHref: creator.tiktokHandle && tiktokUrlFor(creator.tiktokHandle),
      liveHref: creator.tiktokHandle && tiktokLiveUrlFor(creator.tiktokHandle),
    },
    {
      key: 'instagram',
      live: false,
      handle: creator.instagramHandle,
      profileHref: creator.instagramHandle && instagramUrlFor(creator.instagramHandle),
    },
    {
      key: 'discord',
      live: false,
      // Already a full invite URL in creators.js — there is no handle to build from.
      handle: creator.discordInvite,
      profileHref: creator.discordInvite,
    },
  ];

  const pills = entries
    .filter((e) => e.handle)
    .map((e) => {
      const icon = SOCIAL_ICONS[e.key];
      const liveAttrs = e.live === false ? '' : `
           data-platform="${e.key}"
           data-live-for="${creator.id}"
           data-profile-href="${e.profileHref}"
           data-live-href="${e.liveHref}"`;
      const liveBadge = e.live === false ? '' : `
          <span class="platform-pill-live" aria-hidden="true">
            <span class="platform-pill-dot"></span>LIVE
          </span>`;
      return `
        <a class="platform-pill platform-pill--${icon.cssClass}"
           href="${e.profileHref}"${liveAttrs}
           target="_blank"
           rel="noopener noreferrer"
           aria-label="${creator.name} on ${icon.label}">
          <span class="platform-pill-icon" aria-hidden="true">${icon.svg}</span>${liveBadge}
        </a>`;
    })
    .join('');

  return pills ? `<div class="platform-pills">${pills}</div>` : '';
}

/**
 * Wire hover swaps on every .creator-skin image in `root`.
 *
 * Minimal by design — default ↔ hover. Network hardening (load
 * progression, fallback chain, broken-image recovery) is the job of
 * setupSkinLoaders() below; keeping the hover function this small means
 * any future bug is obvious at a glance.
 *
 * Must be called AFTER the cards have been rendered into the DOM
 * (modules/creators.js handles this).
 */
export function initializeSkinHoverEffects(root = document) {
  const skins = root.querySelectorAll('.creator-skin');

  skins.forEach((skin) => {
    // Read default/hover from the dataset LIVE on each event rather than
    // capturing them now. setupSkinLoaders may repoint these to a working
    // fallback after a 3D-render outage; reading live means hover follows
    // that repoint instead of swapping back to a dead URL and blanking the
    // card. When the 3D render is down, default === hover, so the swap is
    // simply a harmless no-op.
    skin.addEventListener('mouseenter', () => {
      if (skin.dataset.hover) skin.src = skin.dataset.hover;
    });
    skin.addEventListener('mouseleave', () => {
      if (skin.dataset.default) skin.src = skin.dataset.default;
    });
  });
}

/** Keep the old (misspelled) name working for callers that already imported it. */
export const intializeSkinHoverEffects = initializeSkinHoverEffects;

/**
 * Progressive skin loader — the second half of the 4-state model.
 *
 *   skeleton  : instant, blocky Minecraft shimmer (always renders)
 *   loading   : skeleton stays visible while the <img> fetches
 *   loaded    : .skin-loaded class fades the image in over the skeleton
 *   failed    : walk the fallback chain (minotar → mc-heads) one renderer at
 *               a time; if every link fails, give up and reveal whatever's
 *               there (the nextFallback index prevents re-trying a dead URL)
 *
 * A renderer counts as failed in two ways: it fires an `error` (e.g. a 502),
 * OR it simply never resolves within STALL_MS (a hung/very slow request). The
 * stall timeout is what guarantees a card never sits shimmering forever behind
 * a primary that's accepting the connection but never returning the image.
 *
 * The stall clock starts when the card nears the viewport, NOT at page load:
 * the images are loading="lazy", so an off-screen card hasn't requested the
 * 3D render yet — arming the timer early would bump it to the flat 2D
 * fallback before the 3D render was ever tried, even while it's perfectly up.
 *
 * The fallback chain matters because 3D-render services can have outright
 * outages, and the simplest 2D fallback (mc-heads) can itself serve an empty
 * 200. Trying minotar before mc-heads keeps the grid populated even when two
 * of the services are misbehaving.
 *
 * Why this is its own function (not part of initializeSkinHoverEffects):
 * the two concerns are independent. Loading happens once per page; hover
 * happens many times. Splitting them keeps teardown semantics clean and
 * lets either be reused without dragging the other along.
 *
 * Returns a teardown via AbortController so listeners don't linger
 * after grid re-renders.
 */
/** Force the fallback if the current renderer hasn't resolved in this long. */
const STALL_MS = 10000;

export function setupSkinLoaders(root = document) {
  const skins = root.querySelectorAll('.creator-skin');
  const controller = new AbortController();
  const { signal } = controller;

  // One observer for the whole grid: it starts each card's stall clock the
  // moment the card nears the viewport (≈ when the lazy <img> actually fires
  // its request). Maps element → its arm() so the shared callback can reach
  // the right per-card closure. When IntersectionObserver is unavailable we
  // arm immediately at setup instead.
  const armers = new WeakMap();
  const observer = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          obs.unobserve(entry.target);
          armers.get(entry.target)?.();
        }
      }, { rootMargin: '200px' })
    : null;

  skins.forEach((skin) => {
    // Ordered fallback renderers to try if the primary fails. Pipe-separated
    // because usernames are alphanumeric/underscore, so '|' never collides.
    const fallbacks = (skin.dataset.fallbacks || '')
      .split('|')
      .map((u) => u.trim())
      .filter(Boolean);
    let nextFallback = 0;

    // Timer that fires markFailed() if the current renderer stalls. Re-armed
    // for each link in the chain so every renderer gets its own 10s window.
    let stallTimer = null;
    const clearStall = () => {
      if (stallTimer !== null) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };
    const armStall = () => {
      if (initialResolved) return;
      clearStall();
      stallTimer = setTimeout(() => markFailed(), STALL_MS);
    };

    // The loader is concerned with the INITIAL render only. Once the first
    // load resolves (success or fallback), this flag flips and subsequent
    // errors are ignored — otherwise a hover URL failure would trigger
    // markFailed and clobber the hover behavior by force-swapping `src` to
    // the fallback. That's the bug we're solving here.
    let initialResolved = false;

    const markLoaded = () => {
      initialResolved = true;
      clearStall();
      // If we settled on a fallback renderer (the primary was down), repoint
      // the hover dataset at the URL that actually loaded. Otherwise the very
      // first hover would swap `src` back to the broken primary and blank the
      // card. Pose-on-hover is sacrificed when the primary is down — a fair
      // trade for a card that keeps showing a real skin.
      if (skin.dataset.default && skin.src !== skin.dataset.default) {
        skin.dataset.default = skin.src;
        skin.dataset.hover = skin.src;
      }
      skin.classList.add('skin-loaded');
      const skeleton = skin.previousElementSibling;
      if (skeleton && skeleton.classList.contains('skin-skeleton')) {
        skeleton.classList.add('skin-skeleton--hidden');
      }
    };

    const markFailed = () => {
      // Hover-triggered errors arrive after initialResolved is true. Let
      // them bubble harmlessly — mouseleave restores the default URL.
      if (initialResolved) return;

      clearStall();

      // Advance through the fallback chain, skipping any URL we're already on.
      // The next `load`/`error`/stall drives the following step; re-arm the
      // timer so this fallback also gets its own 10s window.
      while (nextFallback < fallbacks.length) {
        const url = fallbacks[nextFallback++];
        if (url && skin.src !== url) {
          skin.src = url;
          armStall();
          return;
        }
      }

      // Chain exhausted: accept defeat and reveal whatever's there so the
      // card has something rather than an infinite shimmer.
      initialResolved = true;
      skin.classList.add('skin-loaded', 'skin-failed');
    };

    // Three states the image can be in when JS reaches it:
    //   complete + naturalWidth > 0  →  loaded already (cached)
    //   complete + naturalWidth == 0 →  failed BEFORE JS attached
    //   not complete                 →  still in flight; wait for events
    if (skin.complete) {
      if (skin.naturalWidth > 0) markLoaded();
      else markFailed();
    } else {
      // load is `once: true` because we only need to know about the FIRST
      // successful load. error is NOT `once: true` because we may need it
      // to fire twice (initial failure → fallback failure). The
      // initialResolved guard inside markFailed handles all later cases.
      skin.addEventListener('load',  markLoaded, { signal, once: true });
      skin.addEventListener('error', markFailed, { signal });
      // Clear any pending stall timer when the loaders are torn down.
      signal.addEventListener('abort', clearStall, { once: true });
      // Start the stall clock when the card nears the viewport (so lazy,
      // off-screen cards aren't bumped to the fallback before they've even
      // requested the primary). Without an observer, arm right away.
      if (observer) {
        armers.set(skin, armStall);
        observer.observe(skin);
      } else {
        armStall();
      }
    }
  });

  return () => {
    controller.abort();
    observer?.disconnect();
  };
}

export function creatorCardHTML(creator) {
  const roleVariant = ROLE_VARIANTS[creator.role] || 'creative';
  // Primary 3D render: front-facing full body from NMSR.
  const skinUrl = fullBodySkinUrl(creator.mcUsername, { mode: 'fullbody' });
  // Hover render: the isometric 3/4 angle of the same 3D skin.
  const hoverSkin = fullBodySkinUrl(creator.mcUsername, { mode: 'fullbodyiso' });
  // Ordered flat-2D fallback renderers (minotar → mc-heads), tried in turn by
  // setupSkinLoaders if the 3D render errors or stalls past the timeout.
  const fallbacks = skinFallbackChain(creator.mcUsername);

  // Build the per-platform pill row. Only platforms with a handle render.
  // Each pill has data-platform + data-live-for so modules/creators.js
  // can flip a `.is-live` class when the poller reports live.
  const platformPills = renderPlatformPills(creator);

  // The skeleton is a sibling of the <img> (NOT a child) so the image's
  // z-index can sit above it without the skeleton clipping. Both are
  // absolutely positioned inside .creator-v2-image; setupSkinLoaders
  // hides the skeleton once .skin-loaded is on the image.
  return `
    <article class="creator-v2-card" data-creator="${creator.id}">
      <div class="creator-v2-image">
        <div class="skin-skeleton" aria-hidden="true"></div>
        <img
          class="creator-skin"
          src="${skinUrl}"
          data-default="${skinUrl}"
          data-hover="${hoverSkin}"
          data-fallbacks="${fallbacks.join('|')}"
          alt="${creator.name}'s Minecraft skin"
          loading="lazy">

        ${platformPills}
      </div>

      <div class="creator-v2-meta">
        <h2 class="creator-v2-name">${creator.name}</h2>
        <p class="creator-v2-role creator-v2-role--${roleVariant}">${creator.role}</p>
      </div>
    </article>
  `;
}
