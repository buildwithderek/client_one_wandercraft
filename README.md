# WanderCraft — Redesign

The Adventure Is Everywhere — a creator-collective marketing site. Vanilla HTML, CSS, and ES modules. No build step for runtime.

This is a visual redesign of the original `wandercraft/` project. All JavaScript
(modules, components, data, tests) is unchanged — only `index.html` and
`css/style.css` were rewritten:

- **Design tokens** — one `:root` block drives every surface, color, radius, and
  easing on the site. The palette is sampled from the Season 3 logo: grass
  green `#5BC832`, ocean blue `#29ABE2`, CRAFT orange `#F7941D`, SEASON gold
  `#FFD23F`, on a deep navy base.
- **Calmer hero** — aurora gradient wash and a stats strip instead of clouds,
  birds, and a banner image; two CTAs instead of three.
- **Unified chip system** — creators, content, and fan-art filters share one
  pill design with a single active style.
- **Pill navbar** — links sit in a rounded capsule with an active highlight;
  mobile menu is a floating dropdown card with an animated ✕ toggle.
- **Consistent card system** — creators, content, and merch cards share the
  same border, radius, hover lift, and shadow recipe.
- **Island backdrop** — the WanderCraft world render (`assets/bg/islands.webp`,
  with a JPEG fallback) sits behind the whole site under a dark scrim that
  keeps text readable.
- **Accessibility** — global `:focus-visible` ring, full
  `prefers-reduced-motion` support, larger touch targets.

## Run locally

ES modules require a server (browsers won't load `import` over `file://`). Any static server works:

```bash
npm run serve         # python3 -m http.server 5173
# then open http://localhost:5173
```

Or use VS Code's Live Server, or `npx serve`.

## Test

```bash
npm install           # one-time, installs vitest + jsdom
npm test              # run the suite
npm run test:watch    # watch mode
```

## Project layout

```
wandercraft/
├── index.html              # markup + section anchors
├── css/style.css           # all styles
├── js/
│   ├── main.js             # entry — orchestrates module init
│   ├── globe.js            # Three.js voxel globe
│   ├── data/               # content, copy, links — single source of truth
│   ├── components/         # reusable HTML renderers (cards, icons, modal)
│   ├── modules/            # feature-level init (nav, filters, dashboard…)
│   └── utils/              # pure helpers (geo, parseViews, dom)
└── tests/                  # vitest + jsdom suite
```

## Where to change things

- **Site copy and creator data** — `js/data/`. Don't edit JSX-style strings buried in modules.
- **External URLs** (store, socials, contact) — `js/data/links.js`. One file, one place.
- **Filter / sort logic** — `js/modules/filters.js` + `js/utils/parseViews.js`.
- **Globe tuning** (size, rotation speed, FOV) — `GLOBE_CONFIG` in `js/globe.js`.

## Deploy

It's a static site. Drop the folder on Netlify, GitHub Pages, Cloudflare Pages, or any static host. No build, no node_modules in production.
