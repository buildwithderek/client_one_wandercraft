import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { open, close, openContactInfo } from '../js/components/modal.js';

describe('modal', () => {
  beforeEach(() => {
    // Reset body between tests so the lazily-created modal root is also reset.
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  afterEach(() => {
    close();
  });

  test('open() inserts the modal root and marks it open', () => {
    open({ title: 'Hi', body: '<p>Hello</p>' });
    const root = document.querySelector('.modal-root');
    expect(root).toBeTruthy();
    expect(root.classList.contains('open')).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('false');
  });

  test('open() puts the title and body into the dialog', () => {
    open({ title: 'Test Title', body: '<p>Some body text</p>' });
    expect(document.getElementById('modal-title').textContent).toBe('Test Title');
    expect(document.querySelector('.modal-body').textContent).toContain('Some body text');
  });

  test('close() removes the open state and restores body scroll', () => {
    open({ title: 'Hi', body: '' });
    expect(document.body.style.overflow).toBe('hidden');
    close();
    const root = document.querySelector('.modal-root');
    expect(root.classList.contains('open')).toBe(false);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.style.overflow).toBe('');
  });

  test('clicking the backdrop closes the modal', () => {
    open({ title: 'Hi', body: '' });
    document.querySelector('.modal-backdrop').click();
    expect(document.querySelector('.modal-root').classList.contains('open')).toBe(false);
  });

  test('Escape key closes the modal', () => {
    open({ title: 'Hi', body: '' });
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.modal-root').classList.contains('open')).toBe(false);
  });

  test('openContactInfo() builds a mailto-style primary action', () => {
    openContactInfo({
      title: 'Shop',
      lead: 'Lead text.',
      mailtoHref: 'mailto:playwandercraft@gmail.com?subject=Hi',
      primaryLabel: 'Email Us',
    });
    const primary = document.querySelector('.modal-actions .btn-primary');
    expect(primary).toBeTruthy();
    expect(primary.tagName).toBe('A');
    expect(primary.getAttribute('href')).toContain('mailto:');
    expect(primary.textContent).toBe('Email Us');
  });

  test('always renders a Close button as the secondary action', () => {
    open({ title: 'Hi', body: '' });
    const buttons = document.querySelectorAll('.modal-actions button');
    // Default secondary is rendered as a button (no href).
    const closeBtn = [...buttons].find((b) => b.textContent === 'Close');
    expect(closeBtn).toBeTruthy();
  });
});
