/**
 * Smooth-scroll for in-page anchors. Respects prefers-reduced-motion: under
 * that setting we just jump (which is what the OS-level reduced-motion API
 * actually wants anyway).
 *
 * Scrolling is only half of following a link. This also moves KEYBOARD FOCUS
 * to the target, because preventDefault() cancels the browser's own focus
 * move. Without it "Skip to main content" — the one control that exists purely
 * for keyboard users — scrolled the page and left focus back at the top of the
 * nav, so the next Tab went straight back into the menu.
 */

import { prefersReducedMotion } from '../utils/dom.js';

export function initSmoothScroll() {
  const anchors = document.querySelectorAll('a[href^="#"]');
  anchors.forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
      focusTarget(target);
    });
  });
}

/**
 * Put focus on the thing we just scrolled to.
 *
 * Section elements aren't focusable, so they get tabindex="-1" — focusable by
 * script, still skipped by Tab. preventScroll keeps the browser from undoing
 * the smooth scroll we just started.
 */
function focusTarget(target) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
