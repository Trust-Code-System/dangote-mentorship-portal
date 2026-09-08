'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Adaptive quality for the hero scene.
 *
 * This replaces `@react-three/drei`'s `PerformanceMonitor` + `AdaptiveDpr`.
 * Those two components were the only reason `drei` was a dependency, and drei
 * costs ~86 KiB transferred for what amounts to the forty lines below — on a
 * page whose entire performance problem is the weight of the 3D stack, that is
 * not a trade worth making.
 *
 * Behaviour: sample the real frame rate over 1.5-second windows. If the device
 * cannot hold 40fps, drop the device pixel ratio to 1 and tell the scene to
 * shed particles — once, permanently. Quality never climbs back, because
 * oscillating between budgets is more distracting than simply staying lower.
 */
export function QualityGuard({ onDecline }: { onDecline: () => void }) {
  const setDpr = useThree((state) => state.setDpr);

  const frames = useRef(0);
  const elapsed = useRef(0);
  const declined = useRef(false);

  useFrame((_state, delta) => {
    if (declined.current) return;

    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current < 1.5) return;

    const fps = frames.current / elapsed.current;
    frames.current = 0;
    elapsed.current = 0;

    if (fps < 40) {
      declined.current = true;
      setDpr(1);
      onDecline();
    }
  });

  return null;
}
