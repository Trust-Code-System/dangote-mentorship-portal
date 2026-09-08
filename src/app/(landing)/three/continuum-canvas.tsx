'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContinuumScene } from './continuum-scene';
import { HeroFallback } from './hero-fallback';
import { QualityGuard } from './quality-guard';
import type { RenderTier } from '../hooks/use-can-render-3d';
import { useReducedMotion } from '../hooks/use-reduced-motion';

/**
 * The WebGL hero (LANDING_PAGE_MASTER_SPEC.md §5 and §11).
 *
 * Capability detection deliberately happens in the *parent*, not here: this
 * module is behind `next/dynamic`, so deciding inside it would mean every
 * phone downloaded and parsed ~430 KiB of `three` + `@react-three/fiber` before
 * discovering it was never going to render a canvas. The parent only mounts
 * this component on a device that has already passed the probe, so incapable
 * devices fetch none of the 3D stack.
 *
 * What this component still owns:
 *
 *  - **Context loss.** If the browser drops the context at runtime we swap to
 *    the fallback instead of leaving a dead black rectangle.
 *  - **Frame policy.** `frameloop` is `'always'` only while the hero is on
 *    screen, the tab is visible, and motion is welcome. Otherwise it drops to
 *    `'demand'`, so the page is not burning a GPU at 60fps rendering a scene
 *    nobody is looking at.
 *  - **Quality.** `QualityGuard` steps the scene down if the device cannot hold
 *    the frame rate.
 *
 * The canvas is absolutely positioned inside a parent that already has its
 * size, so mounting it shifts nothing (CLS measured at 0.001).
 */
export default function ContinuumCanvas({
  tier: detectedTier,
}: {
  tier: Exclude<RenderTier, 'none' | 'unknown'>;
}) {
  const reduced = useReducedMotion();

  const [contextLost, setContextLost] = useState(false);
  const [active, setActive] = useState(true);
  // The guard can drop quality; the detected capability sets the ceiling.
  // Keeping only the downgrade in state means `tier` is derived, not mirrored.
  const [downgraded, setDowngraded] = useState(false);
  const tier: Exclude<RenderTier, 'none' | 'unknown'> =
    downgraded || detectedTier === 'medium' ? 'medium' : 'high';

  const containerRef = useRef<HTMLDivElement>(null);
  // Hero scroll progress, 0 → 1. A ref, not state: the camera reads it every
  // frame and re-rendering React for it would be wasteful.
  const scrollProgress = useRef(0);

  // Track hero scroll progress + whether the canvas is worth rendering at all.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onScroll = () => {
      const height = window.innerHeight || 1;
      const top = node.getBoundingClientRect().top;
      scrollProgress.current = Math.min(Math.max(-top / height, 0), 1);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => setActive(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    observer.observe(node);

    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, []);

  const handleCreated = useCallback((state: { gl: { domElement: HTMLCanvasElement } }) => {
    const canvas = state.gl.domElement;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      setContextLost(true);
    });
  }, []);

  if (contextLost) return <HeroFallback />;

  return (
    <div ref={containerRef} aria-hidden className="absolute inset-0">
      <Canvas
        // Decorative: the hero's meaning is entirely in the DOM text beside it.
        aria-hidden
        dpr={[1, 1.75]}
        camera={{ position: [0, 2.1, 11.5], fov: 40 }}
        frameloop={active && !reduced ? 'always' : 'demand'}
        gl={{ antialias: tier === 'high', alpha: false, powerPreference: 'high-performance' }}
        onCreated={handleCreated}
      >
        <Suspense fallback={null}>
          <ContinuumScene tier={tier} reduced={reduced} scrollProgress={scrollProgress} />
          <QualityGuard onDecline={() => setDowngraded(true)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
