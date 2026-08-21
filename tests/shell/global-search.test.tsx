import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GlobalSearch } from '@/components/shell/global-search';

// The panel opens on focus, so WCAG 2.2 SC 1.4.13 requires it to be dismissible
// without moving focus. These cover the dismissal and the latch that stops it
// springing straight back open when focus returns to the input.
//
// Driven with react-dom directly rather than @testing-library/react: the latter
// is in package.json but its @testing-library/dom peer is not installed, and a
// keyboard behaviour test is not worth adding a dependency for.

vi.mock('next-intl', () => ({
  // Render the key itself so assertions don't depend on copy.
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/search/actions', () => ({
  searchPortal: vi.fn(async () => ({ ok: true as const, data: { hits: [] } })),
}));

const NAV = [{ label: 'Dashboard', href: '/dashboard' }];

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/** Let the 300ms search debounce and its awaited action settle. */
async function settle(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

const input = () => container.querySelector('input[type="search"]') as HTMLInputElement;
const panelText = () => container.textContent ?? '';

/** Focus, then type a query matching no nav item and no hit, so the panel
 *  settles on its empty state — a stable thing to assert on. */
async function openPanel(value = 'zz') {
  const el = input();
  await act(async () => {
    el.focus();
    el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
  });
  await act(async () => {
    // React tracks the value setter, so bypass it to fire a real change.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
  return el;
}

async function pressEscape(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

describe('GlobalSearch keyboard dismissal', () => {
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<GlobalSearch navItems={NAV} />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('opens the panel once a query is typed', async () => {
    await openPanel();
    expect(panelText()).toContain('noResults');
  });

  it('closes the panel on Escape and keeps focus in the input', async () => {
    const el = await openPanel();
    expect(panelText()).toContain('noResults');

    await pressEscape(el);

    expect(panelText()).not.toContain('noResults');
    expect(document.activeElement).toBe(el);
  });

  it('stays closed while focus remains in the input after Escape', async () => {
    const el = await openPanel();
    await pressEscape(el);
    expect(panelText()).not.toContain('noResults');

    // Refocusing must not re-trigger the panel — this is the regression the
    // `dismissed` latch exists to prevent.
    await act(async () => {
      el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
    });
    await settle();
    expect(panelText()).not.toContain('noResults');
  });

  it('reopens once the query changes again', async () => {
    const el = await openPanel();
    await pressEscape(el);
    expect(panelText()).not.toContain('noResults');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, 'zzq');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();

    expect(panelText()).toContain('noResults');
  });
});
