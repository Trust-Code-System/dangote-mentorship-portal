'use client';

import { useEffect } from 'react';

// Radix restores focus programmatically after a picker closes. Browsers can
// classify that as :focus-visible even after a pointer selection. Track actual
// input modality so mouse users get a quiet control and keyboard users get a
// reliable focus indicator, including content rendered in portals.
export function InteractionMode() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => {
      root.dataset.inputModality = 'pointer';
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey)
        root.dataset.inputModality = 'keyboard';
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
      delete root.dataset.inputModality;
    };
  }, []);
  return null;
}
