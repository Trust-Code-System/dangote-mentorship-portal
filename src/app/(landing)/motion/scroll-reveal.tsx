'use client';

import { useInView } from '../hooks/use-in-view';
import { cn } from '@/lib/utils';

/**
 * Viewport entrance for blocks (LANDING_PAGE_COMPONENT_MAP.md §2, our
 * equivalent of the scroll-reveal pattern).
 *
 * Deliberately restrained: a short rise and a fade, once, never replayed on
 * scroll-back.
 *
 * Implemented as a CSS transition toggled by one IntersectionObserver rather
 * than an animation-library component. This component appears ~40 times on the
 * page; hydrating that many JS animators was the largest single contributor to
 * main-thread work on a throttled mobile profile, and a class toggle produces
 * an identical result for free. The hidden state and the reduced-motion
 * behaviour both live in globals.css.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds. Used to stagger sibling blocks. */
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);

  return (
    <div
      ref={ref}
      className={cn('landing-reveal', inView && 'is-visible', className)}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
