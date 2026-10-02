/**
 * WanderCraft — entry point.
 *
 * This file is intentionally short. Every feature lives in its own module
 * under js/modules/. main.js's only job is to wire them up after the DOM
 * is ready and bail gracefully if anything throws (so one broken module
 * can't take the whole page down).
 *
 * Adding a new feature:
 *   1. Drop a file in js/modules/ that exports an init* function.
 *   2. Import it here and call it inside boot().
 */

import { initNav } from './modules/nav.js';
import { initParticles } from './modules/particles.js';
import { initScrollReveal } from './modules/scrollReveal.js';
import { initCreators } from './modules/creators.js';
import { initContentDashboard } from './modules/contentDashboard.js';
import { initFanArtGallery } from './modules/fanartGallery.js';
import { initMerch } from './modules/merch.js';
import { initFooter } from './modules/footer.js';
import { initSmoothScroll } from './modules/smoothScroll.js';
import { initButtonGlow } from './modules/buttonGlow.js';

function boot() {
  const steps = [
    ['nav', initNav],
    ['particles', initParticles],
    ['creators', initCreators],
    ['content dashboard', initContentDashboard],
    ['fan art', initFanArtGallery],
    ['merch', initMerch],
    ['footer', initFooter],
    ['smooth scroll', initSmoothScroll],
    ['button glow', initButtonGlow],
    // Scroll reveal runs last so it sees everything the others rendered.
    ['scroll reveal', initScrollReveal],
  ];

  for (const [name, init] of steps) {
    try {
      init();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[WanderCraft] init "${name}" failed:`, err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
