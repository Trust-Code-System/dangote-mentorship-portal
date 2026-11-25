'use client';

// React Bits CountUp's motion/react interpolation, reduced to the count mode.
// Copyright David Haz; source and license in docs/licenses/react-bits.md.
import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView || reduce) return;
    const element = ref.current;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (element) element.textContent = Math.round(latest).toString();
      },
      onComplete: () => {
        if (element) element.textContent = String(value);
      },
    });
    return () => {
      controls.stop();
      if (element) element.textContent = String(value);
    };
  }, [inView, reduce, value]);
  return (
    <>
      <span className="sr-only">{value}</span>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
    </>
  );
}
