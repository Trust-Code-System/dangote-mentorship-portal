'use client';

import { motion, useScroll, useSpring } from 'motion/react';
import { useReducedMotion } from '../hooks/use-reduced-motion';

/**
 * A hairline green→gold rail across the top of the viewport showing how far
 * through the narrative the visitor is — the page's only persistent progress
 * signal, matching the story's own green→gold arc (growth → completion).
 *
 * Purely decorative: the same progress is legible from the content itself, so
 * it is hidden from assistive technology. Hidden entirely under reduced motion
 * rather than snapping between values.
 */
export function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  if (reduced) return null;

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[55] h-0.5 origin-left bg-gradient-to-r from-blak-green via-blak-green-soft to-blak-gold"
    />
  );
}
