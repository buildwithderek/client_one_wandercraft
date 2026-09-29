/**
 * Lightweight, accessible modal used for "Upload Art", "Shop Now",
 * and "Visit Full Store" calls-to-action.
 *
 * Behavior:
 *   - Focus moves into the dialog on open and is restored on close.
 *   - Esc closes. Click outside the dialog closes. Tab is trapped inside.
 *   - Body scroll is locked while open.
 *
 * The modal is created once per page and reused — open() updates the
 * contents and shows it, close() hides it.
 */

import { CONTACT_EMAIL } from '../data/links.js';

let rootEl = null;
let lastFocused = null;
let keydownBound = false;

import { escapeHtml, escapeUrl } from '../utils/escape.js';

function ensureRoot() {
  // If our cached node is still attached to the document, reuse it.
  // If something removed it (test teardown, host page re-rendering), drop
  // the stale reference and build a fresh one.
  if (rootEl && document.body.contains(rootEl)) return rootEl;
  rootEl = null;

  rootEl = document.createElement('div');
  rootEl.className = 'modal-root';
  rootEl.setAttribute('aria-hidden', 'true');
  rootEl.innerHTML = `
    <div class="modal-backdrop" data-modal-close></div>
    <div class="modal-dialog"
         role="dialog"
         aria-modal="true"
         aria-labelledby="modal-title"
         tabindex="-1">
      <button type="button" class="modal-close" data-modal-close aria-label="Close">×</button>
      <h3 id="modal-title" class="modal-title"></h3>
      <div class="modal-body"></div>
      <div class="modal-actions"></div>
    </div>
  `;
  document.body.appendChild(rootEl);

  rootEl.addEventListener('click', (e) => {
    if (e.target.matches('[data-modal-close]')) close();
  });

  // Bind the global keydown listener exactly once for the lifetime of the
  // page. ensureRoot() may rebuild the modal root (e.g. between tests) but
  // the handler reads the module-level rootEl, so it stays correct.
  if (!keydownBound) {
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') trapFocus(e);
    });
    keydownBound = true;
  }

  return rootEl;
}

function isOpen() {
  return rootEl && rootEl.classList.contains('open');
}

function trapFocus(e) {
  const focusables = rootEl.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Open the modal with provided content.
 *
 *   open({
 *     title: 'Upload Fan Art',
 *     body:  'Send your work to ' + CONTACT_EMAIL,
 *     primary: { label: 'Email Submission', href: 'mailto:...' },
 *     secondary: { label: 'Cancel' }   // close-only by default
 *   })
 */
export function open({ title, body, primary, secondary, variant }) {
  const root = ensureRoot();
  lastFocused = document.activeElement;

  // Variants only widen/restyle the shell; all the dialog behaviour is shared.
  root.classList.remove(...[...root.classList].filter((c) => c.startsWith('modal-root--')));
  if (variant) root.classList.add(`modal-root--${variant}`);

  root.querySelector('#modal-title').textContent = title || '';
  root.querySelector('.modal-body').innerHTML = body || '';

  const actions = root.querySelector('.modal-actions');
  actions.innerHTML = '';
  if (primary) {
    actions.appendChild(actionButton(primary, 'btn btn-primary'));
  }
  actions.appendChild(actionButton(secondary || { label: 'Close' }, 'btn btn-outline'));

  root.classList.add('open');
  root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus the dialog itself so screen readers announce the title, then the
  // user tabs into the actions.
  //
  // Deferred a frame on purpose: .open has only just been set, and the root
  // is still visibility:hidden until styles recalculate. Focusing a hidden
  // element is a no-op, which left focus outside the dialog entirely — so
  // Esc worked but a screen reader was never taken into it.
  const dialog = root.querySelector('.modal-dialog');
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => dialog.focus());
  else dialog.focus();
}

export function close() {
  if (!rootEl) return;
  rootEl.classList.remove('open');
  rootEl.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus();
  }
}

function actionButton(action, defaultClass) {
  if (action.href) {
    const a = document.createElement('a');
    a.href = action.href;
    a.className = action.className || defaultClass;
    a.textContent = action.label;
    if (action.href.startsWith('http')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.addEventListener('click', () => {
      // Close after the navigation kicks off; mailto opens the user's mail app.
      setTimeout(close, 100);
    });
    return a;
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = action.className || defaultClass;
  btn.textContent = action.label;
  btn.addEventListener('click', () => {
    if (action.onClick) action.onClick();
    close();
  });
  return btn;
}

/**
 * Lightbox for a single image.
 *
 * Reuses the dialog wholesale — Esc, backdrop click, focus trap, scroll lock
 * and focus restore are already solved here, and a gallery should not
 * reimplement any of them.
 *
 * Values are escaped even though fan-art data is authored in the repo: `body`
 * is assigned as innerHTML, and a title with a stray quote should break
 * nothing.
 */
export function openImage({ title, caption, src, width, height, alt }) {
  const safeSrc = escapeUrl(src);
  if (!safeSrc) return;
  open({
    title,
    variant: 'image',
    body: `
      <figure class="modal-figure">
        <img src="${safeSrc}"
             alt="${escapeHtml(alt || title || '')}"
             ${width && height ? `width="${escapeHtml(width)}" height="${escapeHtml(height)}"` : ''}>
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
      </figure>
    `,
  });
}

/** Convenience for "this isn't live yet, here's how to reach us" CTAs. */
export function openContactInfo({ title, lead, mailtoHref, primaryLabel = 'Email Us' }) {
  open({
    title,
    body: `
      <p>${lead}</p>
    `,
    primary: { label: primaryLabel, href: mailtoHref },
  });
}
