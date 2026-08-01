import { describe, test, expect, vi, afterEach } from 'vitest';
import { creatorCardHTML, setupSkinLoaders } from '../js/components/creatorCard.js';
import { contentCardHTML } from '../js/components/contentCard.js';
import { fanArtItemHTML } from '../js/components/fanartItem.js';
import { merchCardHTML } from '../js/components/merchCard.js';

/** Parse an HTML string into a DocumentFragment so we can query it. */
function parse(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}

describe('creatorCardHTML (playwandercraft layout)', () => {
  const creator = {
    id: 'senseitalon',
    name: 'SenseiTalon',
    role: 'FOUNDER',
    mcUsername: 'SenseiTalon',
    twitchUsername: 'senseitalon',
  };

  test('renders the creator name as a heading', () => {
    const frag = parse(creatorCardHTML(creator));
    expect(frag.querySelector('h2').textContent.trim()).toBe('SenseiTalon');
  });

  test('renders the role in upper-case under the name', () => {
    const frag = parse(creatorCardHTML(creator));
    expect(frag.querySelector('.creator-v2-role').textContent).toBe('FOUNDER');
  });

  test('applies the matching role variant class for styling', () => {
    const founder = parse(creatorCardHTML(creator));
    expect(founder.querySelector('.creator-v2-role--founder')).toBeTruthy();

    const admin = parse(creatorCardHTML({ ...creator, role: 'HEAD ADMIN' }));
    expect(admin.querySelector('.creator-v2-role--head-admin')).toBeTruthy();

    const wanderer = parse(creatorCardHTML({ ...creator, role: 'CREATIVE WANDERER' }));
    expect(wanderer.querySelector('.creator-v2-role--creative')).toBeTruthy();
  });

  test('embeds the 3D Minecraft skin render URL (NMSR) from the username', () => {
    const frag = parse(creatorCardHTML(creator));
    const img = frag.querySelector('img');
    expect(img.getAttribute('src')).toContain('nmsr.nickac.dev');
    expect(img.getAttribute('src')).toContain('SenseiTalon');
  });

  test('hover swaps to the isometric 3D angle of the same skin', () => {
    const frag = parse(creatorCardHTML(creator));
    const img = frag.querySelector('img');
    expect(img.getAttribute('data-hover')).toContain('fullbodyiso');
  });

  test('image has an ordered fallback chain (minotar before mc-heads)', () => {
    const frag = parse(creatorCardHTML(creator));
    const img = frag.querySelector('img');
    const chain = img.getAttribute('data-fallbacks').split('|');
    expect(chain[0]).toContain('minotar.net');
    expect(chain[1]).toContain('mc-heads.net');
  });

  test('image uses lazy loading', () => {
    const frag = parse(creatorCardHTML(creator));
    expect(frag.querySelector('img').getAttribute('loading')).toBe('lazy');
  });

  test('renders a Twitch platform pill when twitchUsername is set', () => {
    const frag = parse(creatorCardHTML(creator));
    const pill = frag.querySelector('.platform-pill[data-platform="twitch"]');
    expect(pill).toBeTruthy();
    expect(pill.getAttribute('href')).toBe('https://www.twitch.tv/senseitalon');
    // Offline by default — modules/creators.js adds .is-live on a transition.
    expect(pill.classList.contains('is-live')).toBe(false);
    expect(pill.querySelector('.platform-pill-live')).toBeTruthy();
  });

  test('pills carry the live-swap hooks the poller looks up', () => {
    const frag = parse(creatorCardHTML(creator));
    const pill = frag.querySelector('.platform-pill[data-platform="twitch"]');
    expect(pill.dataset.liveFor).toBe('senseitalon');
    expect(pill.dataset.profileHref).toBe('https://www.twitch.tv/senseitalon');
    expect(pill.dataset.liveHref).toBe('https://www.twitch.tv/senseitalon');
  });

  test('renders one pill per platform the creator has a handle for', () => {
    const frag = parse(creatorCardHTML({
      ...creator,
      youtubeHandle: 'senseitalon',
      tiktokHandle: 'senseitalon',
    }));
    const platforms = [...frag.querySelectorAll('.platform-pill')]
      .map((p) => p.dataset.platform);
    expect(platforms).toEqual(['twitch', 'youtube', 'tiktok']);
    // YouTube/TikTok swap to a distinct /live URL when the creator goes live.
    const yt = frag.querySelector('.platform-pill[data-platform="youtube"]');
    expect(yt.dataset.profileHref).toBe('https://www.youtube.com/@senseitalon');
    expect(yt.dataset.liveHref).toBe('https://www.youtube.com/@senseitalon/live');
  });

  test('omits the pill row entirely when the creator has no platform handles', () => {
    const frag = parse(creatorCardHTML({ ...creator, twitchUsername: null }));
    expect(frag.querySelector('.platform-pill')).toBeFalsy();
    expect(frag.querySelector('.platform-pills')).toBeFalsy();
  });

  test('exposes data-creator for DOM lookups by id', () => {
    const frag = parse(creatorCardHTML(creator));
    expect(frag.querySelector('.creator-v2-card').dataset.creator).toBe('senseitalon');
  });
});

describe('setupSkinLoaders stall timeout', () => {
  // Immediately-intersecting observer so the stall clock arms on observe().
  class ImmediateIO {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
    unobserve() {}
    disconnect() {}
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function mountStalledSkin() {
    document.body.innerHTML = `
      <div class="creator-v2-image">
        <div class="skin-skeleton"></div>
        <img class="creator-skin"
             src="https://nmsr.nickac.dev/fullbody/Foo"
             data-default="https://nmsr.nickac.dev/fullbody/Foo"
             data-fallbacks="https://minotar.net/body/Foo/300.png|https://mc-heads.net/body/Foo/right">
      </div>`;
    const img = document.querySelector('.creator-skin');
    // Force the "in flight" branch: request issued, nothing resolved yet.
    Object.defineProperty(img, 'complete', { value: false, configurable: true });
    return img;
  }

  test('falls back to the 2D renderer if the 3D render stalls for 10s', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', ImmediateIO);
    const img = mountStalledSkin();

    const teardown = setupSkinLoaders(document);
    expect(img.getAttribute('src')).toContain('nmsr.nickac.dev'); // still on 3D

    vi.advanceTimersByTime(9999);
    expect(img.getAttribute('src')).toContain('nmsr.nickac.dev'); // not yet

    vi.advanceTimersByTime(1);
    expect(img.getAttribute('src')).toContain('minotar.net');     // stalled → 2D backup
    teardown();
  });

  test('a successful load cancels the stall timer (no fallback swap)', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', ImmediateIO);
    const img = mountStalledSkin();

    const teardown = setupSkinLoaders(document);
    img.dispatchEvent(new Event('load'));   // 3D render resolves before 10s
    vi.advanceTimersByTime(10000);

    expect(img.getAttribute('src')).toContain('nmsr.nickac.dev'); // stayed on 3D
    expect(img.classList.contains('skin-loaded')).toBe(true);
    teardown();
  });
});

describe('contentCardHTML', () => {
  const item = {
    id: 'arctic-100',
    title: 'Surviving 100 Days',
    creator: 'AtlasVoyager',
    type: 'videos',
    views: '2.1M views',
    date: '3 days ago',
    duration: '42:18',
    color: '#1B4965',
  };

  test('renders title, creator, and views', () => {
    const frag = parse(contentCardHTML(item, 0));
    expect(frag.querySelector('h3').textContent).toBe('Surviving 100 Days');
    expect(frag.querySelector('.content-creator-name').textContent).toBe('AtlasVoyager');
    expect(frag.querySelector('.content-views-date').textContent).toContain('2.1M');
  });

  test('exposes the type as data-type for the filter to read', () => {
    const frag = parse(contentCardHTML(item, 0));
    expect(frag.querySelector('.content-card').dataset.type).toBe('videos');
  });

  test('staggers entry animation via animation-delay style', () => {
    const frag = parse(contentCardHTML(item, 4));
    expect(frag.querySelector('.content-card').getAttribute('style')).toContain('animation-delay: 0.32s');
  });

  test('renders the correct badge label for the content type', () => {
    const frag = parse(contentCardHTML(item, 0));
    expect(frag.querySelector('.content-badge').textContent).toBe('Video');

    const short = parse(contentCardHTML({ ...item, type: 'shorts' }, 0));
    expect(short.querySelector('.content-badge').textContent).toBe('Short');
  });
});

describe('fanArtItemHTML', () => {
  const item = { id: 'a', title: 'Sunset', artist: 'Pixel42', type: 'artwork', likes: 1234, height: 200, color: '#FF8C42' };

  test('renders title, artist, and like count formatted with commas', () => {
    const frag = parse(fanArtItemHTML(item));
    expect(frag.querySelector('h4').textContent).toBe('Sunset');
    expect(frag.querySelector('p').textContent).toBe('by Pixel42');
    expect(frag.querySelector('.fanart-likes').textContent).toContain('1,234');
  });

  test('exposes type as data-type for filtering', () => {
    const frag = parse(fanArtItemHTML(item));
    expect(frag.querySelector('.fanart-item').dataset.type).toBe('artwork');
  });
});

describe('merchCardHTML', () => {
  const base = {
    id: 'tee',
    name: 'Explorer Tee',
    category: 'T-Shirt',
    price: '$34.99',
    image: 'https://cdn.example.com/tee.jpg',
    url: 'https://shopwandercraft.com/products/explorer-tee',
    badge: null,
  };

  test('the whole card is a link to the live product page', () => {
    const frag = parse(merchCardHTML(base));
    const card = frag.querySelector('a.merch-card');
    expect(card).toBeTruthy();
    expect(card.getAttribute('href')).toBe('https://shopwandercraft.com/products/explorer-tee');
    expect(card.getAttribute('target')).toBe('_blank');
    expect(card.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('renders the product photo, name, category, and price', () => {
    const frag = parse(merchCardHTML(base));
    expect(frag.querySelector('.merch-photo').getAttribute('src')).toBe('https://cdn.example.com/tee.jpg');
    expect(frag.querySelector('.merch-photo').getAttribute('alt')).toBe('Explorer Tee');
    expect(frag.querySelector('.merch-name').textContent).toBe('Explorer Tee');
    expect(frag.querySelector('.merch-category').textContent).toBe('T-Shirt');
    expect(frag.querySelector('.merch-price').textContent).toBe('$34.99');
  });

  test('omits the badge when item.badge is null', () => {
    const frag = parse(merchCardHTML(base));
    expect(frag.querySelector('.merch-badge')).toBeFalsy();
  });

  test('renders the badge with its variant class when present', () => {
    const frag = parse(merchCardHTML({ ...base, badge: { label: 'New', variant: 'new' } }));
    const badge = frag.querySelector('.merch-badge');
    expect(badge).toBeTruthy();
    expect(badge.classList.contains('new')).toBe(true);
    expect(badge.textContent).toBe('New');
  });
});
