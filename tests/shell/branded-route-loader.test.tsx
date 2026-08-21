import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

// This is the fallback behind certificate / final-review / help / mid-term-review,
// which previously showed the dashboard's stat-card skeleton — a screen of empty
// grey boxes in the shape of a different page.

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'loading' ? 'Loading…' : key),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<BrandedRouteLoader />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('BrandedRouteLoader', () => {
  it('exposes a busy status to assistive tech', () => {
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute('aria-busy')).toBe('true');
  });

  it('announces the localized loading string rather than the brand name', () => {
    const sr = container.querySelector('.sr-only');
    expect(sr?.textContent).toBe('Loading…');
  });

  it('renders the brand mark but hides it from assistive tech', () => {
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    // The mark carries its own alt="BLAK MOH"; announcing it here would talk over
    // the status text, so the wrapper hides it.
    expect(img?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('reuses the root splash animation classes so both tiers match', () => {
    expect(container.querySelector('.brand-splash-mark')).not.toBeNull();
    expect(container.querySelector('.brand-splash-bar')).not.toBeNull();
  });

  it('renders no stat-card skeleton boxes', () => {
    // The regression being fixed: the dashboard skeleton leaking onto pages that
    // are not shaped like the dashboard.
    expect(container.querySelectorAll('.h-28').length).toBe(0);
    expect(container.querySelectorAll('.h-56').length).toBe(0);
  });
});
