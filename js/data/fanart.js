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
 *   width   the image's TRUE pixel width
 *   height  the image's TRUE pixel height — together these give the tile its
 *           aspect ratio, so art is shown whole instead of being cropped to a
 *           fixed box. An item with no width falls back to treating `height`
 *           as a fixed tile height, which is how this used to work.
 */

export const FAN_ART_ITEMS = [
  { id: 'fan-art-1', title: 'Making a Splash', artist: 'Community', type: 'artwork', likes: 0, width: 655, height: 800, color: '#29ABE2', image: 'assets/fanArt/fan_art1.webp' },
  { id: 'fan-art-2', title: '2026 Contest Winner',           artist: 'Community', type: 'artwork', likes: 0, width: 800, height: 524, color: '#5BC832', image: 'assets/fanArt/Winner.webp' },
  { id: 'fan-art-4', title: 'Sweet Beats',     artist: 'Community', type: 'artwork', likes: 0, width: 800, height: 800, color: '#EC4899', image: 'assets/fanArt/fan_art4.webp' },
  { id: 'fan-art-5', title: 'MINECO Supremacy', artist: 'MISERY',    type: 'artwork', likes: 0, width: 800, height: 450, color: '#8B2D8C', image: 'assets/fanArt/fan_art5.webp' },
  { id: 'fan-art-6', title: 'Matcha Potato',    artist: 'Community', type: 'artwork', likes: 0, width: 515, height: 350, color: '#4CAF7D', image: 'assets/fanArt/fan_art6.webp' },
  { id: 'fan-art-7', title: 'Season 2',         artist: 'Community', type: 'artwork', likes: 0, width: 800, height: 635, color: '#29ABE2', image: 'assets/fanArt/fan_art7.webp' },
  { id: 'fan-art-8', title: 'Bucket Buddies',   artist: 'Community', type: 'artwork', likes: 0, width: 708, height: 800, color: '#D9C3A5', image: 'assets/fanArt/fan_art8.webp' },
];
