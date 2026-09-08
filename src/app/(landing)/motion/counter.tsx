'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

/**
 * Count-up for the programme figures (spec §8 / brief §16).
 *
 * Rules it obeys:
 *  - counts once, the first time it is seen, never on scroll-back;
 *  - starts from 0, not from an implausible large number;
 *  - uses tabular numerals so the glyph width never jitters;
 *  - the **final** value is always what assistive technology reads — the
 *    animating digits are `aria-hidden` and an `sr-only` span carries the real
 *    number from the very first render, so the value is available immediately
 *    even if the animation never runs;
 *  - renders the final value outright under reduced motion.
 *
 * Values here are small verified integers (9, 6, 2, 1), so a short linear ramp
 * is more legible than an easing curve.
 */
export function Counter({ value, className }: { value: string; className?: string }) {
  const reduced = useReducedMotion();
  const target = Number.parseInt(value, 10);
  const isNumeric = Number.isFinite(target);

  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const hasRun = useRef(false);
  // Held outside the observer callback so unmount can actually cancel the ramp.
  const frame = useRef(0);

  useEffect(() => {
    if (!isNumeric || reduced || hasRun.current) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || hasRun.current) return;
        hasRun.current = true;
        observer.disconnect();

        const duration = 900;
        const start = performance.now();

        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          setDisplay(Math.round(target * progress));
          if (progress < 1) frame.current = requestAnimationFrame(step);
        };
        frame.current = requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [isNumeric, reduced, target]);

  // Non-numeric values (should any be added later) render verbatim.
  if (!isNumeric) {
    return <span className={cn('tabular-nums', className)}>{value}</span>;
  }

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden>{reduced ? target : display}</span>
    </span>
  );
}
