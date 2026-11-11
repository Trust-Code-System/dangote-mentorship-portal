'use client';

// Adapted from React Bits AnimatedContent by David Haz.
// Source and license: docs/licenses/react-bits.md. The portal uses only its
// mount/stagger reveal, with visible server HTML and live reduced-motion support.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';

export function AnimatedContent({
  children,
  className,
  stagger = 0.055,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const element = ref.current;
        if (!element) return;
        gsap.fromTo(
          Array.from(element.children),
          { y: 10, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            stagger,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
        );
      },
      ref,
    );
    return () => media.revert();
  }, [stagger]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
