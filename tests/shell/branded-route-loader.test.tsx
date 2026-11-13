import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

const route = vi.hoisted(() => ({ pathname: '/admin/mentees' as string | null }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'loading' ? 'Loading…' : key),
}));
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  route.pathname = '/admin/mentees';
});
async function render(props = {}) {
  await act(async () => root.render(<BrandedRouteLoader {...props} />));
}

describe('Route loading accessibility', () => {
  it('announces one localized busy status while hiding decorative placeholders', async () => {
    await render();
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.sr-only')?.textContent).toBe('Loading…');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
  it('does not present placeholders as editable data or available actions', async () => {
    route.pathname = '/profile';
    await render();
    expect(container.querySelector('input, textarea, button, a, [tabindex]')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
  it('also renders before a pathname is available', async () => {
    route.pathname = null;
    await render();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
  it('retains the accessible status when used on dark public pages with route-specific spacing', async () => {
    await render({ tone: 'dark', className: 'min-h-[22rem]' });
    const status = container.querySelector('[role="status"]');
    expect(status?.className).toContain('min-h-[22rem]');
    expect(status?.getAttribute('aria-busy')).toBe('true');
  });
});
