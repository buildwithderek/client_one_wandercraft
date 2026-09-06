/**
 * Fan-art gallery — the top 4 featured pieces.
 *
 * The gallery renders only the first 4 items here (see modules/fanartGallery.js),
 * so this is an ordered "featured" list: put the piece you want first, first.
 *
 * Fields:
 *   id      stable key (also the localStorage key suffix for likes)
 *   title   shown in the hover overlay
 *   artist  credited below the title
 *   type    'artwork' | 'pixel' | 'builds' | 'screenshots'
 *   likes   starting like count — kept at 0 so the number only goes up when a
 *           real visitor taps the heart. Each browser can add one like, and it's
 *           remembered locally (localStorage); there's no shared backend, so the
 *           count isn't aggregated across different people/devices.
 *   height  tile height in px (masonry layout)
 *   color   placeholder gradient shown until the image loads / if it 404s
 *   image   path under assets/fanArt/ (capital A)
 */

export const FAN_ART_ITEMS = [
  { id: 'fan-art-1', title: 'Making a Splash', artist: 'Community', type: 'artwork', likes: 0, height: 340, color: '#29ABE2', image: 'assets/fanArt/fan_art1.webp' },
  { id: 'fan-art-2', title: '2026 Contest Winner',           artist: 'Community', type: 'artwork', likes: 0, height: 260, color: '#5BC832', image: 'assets/fanArt/Winner.webp' },
  { id: 'fan-art-3', title: 'Peace',           artist: 'Community', type: 'artwork', likes: 0, height: 340, color: '#F7941D', image: 'assets/fanArt/fan_art3.webp' },
  { id: 'fan-art-4', title: 'Sweet Beats',     artist: 'Community', type: 'artwork', likes: 0, height: 300, color: '#EC4899', image: 'assets/fanArt/fan_art4.webp' },
  { id: 'fan-art-5', title: 'MINECO Supremacy', artist: 'MISERY',    type: 'artwork', likes: 0, height: 190, color: '#8B2D8C', image: 'assets/fanArt/fan_art5.webp' },
  { id: 'fan-art-6', title: 'Matcha Potato',    artist: 'Community', type: 'artwork', likes: 0, height: 200, color: '#4CAF7D', image: 'assets/fanArt/fan_art6.webp' },
  { id: 'fan-art-7', title: 'Season 2',         artist: 'Community', type: 'artwork', likes: 0, height: 240, color: '#29ABE2', image: 'assets/fanArt/fan_art7.webp' },
  { id: 'fan-art-8', title: 'Bucket Buddies',   artist: 'Community', type: 'artwork', likes: 0, height: 360, color: '#D9C3A5', image: 'assets/fanArt/fan_art8.webp' },
];
