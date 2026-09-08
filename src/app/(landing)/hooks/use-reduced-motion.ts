'use client';

import { useSyncExternalStore } from 'react';

/**
 * Single source of truth for the landing page's motion gate
 * (LANDING_PAGE_MASTER_SPEC.md §8).
 *
 * Returns `true` when the visitor has asked for reduced motion. Every animated
 * component on the landing page reads this and renders its *end state* instead
 * of animating — content and functionality are never removed, only the movement.
 *
 * Implemented with `useSyncExternalStore` rather than `useState` + `useEffect`:
 * the media query *is* an external store, so this subscribes to it directly
 * instead of copying it into React state and re-rendering once on mount. The
 * server snapshot is `false`, so SSR markup matches the first client render and
 * components must treat the reduced state as a switch to a static end-state
 * rather than a reason to unmount anything.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
