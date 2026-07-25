/** Pure visual state for a sidebar destination — never active + pending together. */
export type NavItemVisualState = 'active' | 'pending' | 'inactive';

export function isNavItemCommitted(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  if (href === pathname) return true;
  if (exact) return false;
  return href !== '/' && pathname.startsWith(href + '/');
}

/**
 * Active = committed route when no navigation is in flight.
 * Pending = clicked destination awaiting URL commit.
 * Inactive = everything else (including the previous route while pending).
 */
export function resolveNavItemVisualState(args: {
  pathname: string;
  href: string;
  exact?: boolean;
  pendingHref: string | null;
}): NavItemVisualState {
  const { pathname, href, exact, pendingHref } = args;
  if (pendingHref === href) return 'pending';
  const committed = isNavItemCommitted(pathname, href, exact);
  if (committed && pendingHref === null) return 'active';
  return 'inactive';
}
