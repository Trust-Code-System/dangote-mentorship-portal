import { describe, expect, it } from 'vitest';
import {
  isNavItemCommitted,
  resolveNavItemVisualState,
} from '@/components/shell/nav-item-state';

describe('resolveNavItemVisualState', () => {
  it('marks only the committed route as active when idle', () => {
    expect(
      resolveNavItemVisualState({
        pathname: '/admin/insights',
        href: '/admin/insights',
        pendingHref: null,
      }),
    ).toBe('active');
    expect(
      resolveNavItemVisualState({
        pathname: '/admin/insights',
        href: '/admin/programmes',
        pendingHref: null,
      }),
    ).toBe('inactive');
  });

  it('never returns active for two destinations while pending', () => {
    const pendingHref = '/admin/programmes';
    const insights = resolveNavItemVisualState({
      pathname: '/admin/insights',
      href: '/admin/insights',
      pendingHref,
    });
    const programmes = resolveNavItemVisualState({
      pathname: '/admin/insights',
      href: '/admin/programmes',
      pendingHref,
    });
    expect(insights).toBe('inactive');
    expect(programmes).toBe('pending');
    expect([insights, programmes].filter((s) => s === 'active')).toHaveLength(0);
  });

  it('moves pending to the newest destination', () => {
    expect(
      resolveNavItemVisualState({
        pathname: '/admin/insights',
        href: '/admin/programmes',
        pendingHref: '/admin/cohorts',
      }),
    ).toBe('inactive');
    expect(
      resolveNavItemVisualState({
        pathname: '/admin/insights',
        href: '/admin/cohorts',
        pendingHref: '/admin/cohorts',
      }),
    ).toBe('pending');
  });

  it('uses exact match for index admin routes', () => {
    expect(isNavItemCommitted('/admin/matching', '/admin', true)).toBe(false);
    expect(isNavItemCommitted('/admin', '/admin', true)).toBe(true);
  });
});
