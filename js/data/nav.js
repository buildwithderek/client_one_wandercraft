/**
 * Top-nav and footer link configuration.
 *
 * `id` matches the section's id in index.html — this is what we use to
 * highlight the active link as the user scrolls.
 */

// In-page sections in document order — drives the scroll-spy active highlight.
export const NAV_LINKS = [
  { id: 'home', label: 'Home' },
  { id: 'creators', label: 'Creators' },
  { id: 'content', label: 'Content' },
  // Merch hidden for the new season: { id: 'merch', label: 'Merch' },
  { id: 'fanart', label: 'Fan Art' },
  { id: 'about', label: 'About' },
];

/** Footer column groups. Each link is either an in-page anchor or an external href. */
export const FOOTER_GROUPS = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', href: '#home' },
      { label: 'Creators', href: '#creators' },
      { label: 'Content', href: '#content' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Fan Art', href: '#fanart' },
      // Merch hidden for the new season: { label: 'Merch', href: '#merch' },
      { label: 'About', href: '#about' },
    ],
  },
  // The Connect column is built dynamically from links.js so URLs stay centralized.
];
