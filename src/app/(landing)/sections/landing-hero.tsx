'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { HeroRevealText } from '../motion/hero-reveal-text';
import { LightField } from '../visuals/light-field';
import { HeroFallback } from '../three/hero-fallback';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { useCanRender3D } from '../hooks/use-can-render-3d';

/**
 * The 3D scene is loaded only in the browser. `ssr: false` keeps `three` out of
 * the server render entirely, and the `loading` state is the real designed
 * fallback rather than a spinner — so the hero looks finished from the first
 * paint and the WebGL scene is a quiet upgrade on top of it (spec §9).
 */
const ContinuumCanvas = dynamic(() => import('../three/continuum-canvas'), {
  ssr: false,
  loading: () => <HeroFallback />,
});

/**
 * Holds the 3D bundle back until the browser is genuinely idle.
 *
 * Measured, not guessed: importing `three` + `@react-three/fiber` during
 * hydration cost **1.28s of total blocking time** in a Lighthouse run against
 * the production build. Parsing and initialising all of that competes directly
 * with making the page interactive, and it buys nothing — the hero is already
 * complete and readable via `HeroFallback`.
 *
 * Waiting for `requestIdleCallback` moves that work after the page is usable
 * (TBT fell to 400ms). The 1500ms timeout is a ceiling, not a delay: on a fast
 * machine idle fires almost immediately. Safari has no `requestIdleCallback`,
 * hence the fallback.
 */
function useIdleReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (typeof idle === 'function') {
      const handle = idle(() => setReady(true), { timeout: 1500 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return ready;
}

/**
 * The hero — the defining moment of the page.
 *
 * Layering, back to front: the 3D scene (or its fallback) → the environmental
 * light field → a radial readability mask → an edge vignette → the copy. The
 * mask is what lets the scene be genuinely dark and moving while the headline
 * still holds its contrast.
 *
 * **Every piece of hero copy animates with CSS, not JavaScript.** The headline,
 * sub-copy and both CTAs are server-rendered and begin animating at first
 * paint, so nothing above the fold waits on hydration or on WebGL — see the
 * hero-entrance block in globals.css for the measurement behind that.
 */
export function LandingHero() {
  const t = useTranslations('landing.hero');
  const reduced = useReducedMotion();
  const sceneReady = useIdleReady();
  // Probed here rather than inside the canvas module so an incapable device
  // never triggers the dynamic import at all — see ContinuumCanvas.
  const tier = useCanRender3D();
  const showCanvas = sceneReady && !reduced && (tier === 'high' || tier === 'medium');

  return (
    <section className="relative isolate flex min-h-[100svh] w-full flex-col justify-center overflow-hidden px-4 pb-24 pt-32 sm:px-6 sm:pb-28 sm:pt-36">
      {/* ── Scene layers ── */}
      <div className="absolute inset-0 -z-10">
        {showCanvas ? <ContinuumCanvas tier={tier} /> : <HeroFallback />}
        <LightField />
        <div className="landing-readability-mask absolute inset-0" />
        <div className="landing-vignette absolute inset-0" />
      </div>

      <div className="mx-auto w-full max-w-[1280px]">
        {/* Micro-label — only claims the application actually supports. */}
        <p
          className="landing-hero-enter text-blak-label uppercase text-blak-green-soft"
          style={{ animationDelay: '0.1s' }}
        >
          {t('micro')}
        </p>

        {/* Held to ~11 characters on wide screens so the headline never runs
            into the right half of the frame, where the scene lives. */}
        <h1 className="mt-6 max-w-[18ch] text-blak-hero font-extrabold text-blak-text lg:max-w-[11ch]">
          <HeroRevealText text={t('line1')} delay={0.2} as="span" className="block" />
          {/* The turn in the sentence gets the editorial serif and the only
              green→gold light treatment on the page — applied across the whole
              line, never per word (a per-word gradient repeats into a rainbow). */}
          <HeroRevealText
            text={t('line2')}
            delay={0.42}
            as="span"
            className="mt-1 block font-serif font-normal italic tracking-[-0.01em]"
            gradient
          />
        </h1>

        {/* This paragraph is the measured LCP element, so its entrance is kept
            deliberately short — every millisecond of delay or duration here is
            a millisecond added to Largest Contentful Paint. */}
        <p
          className="landing-hero-enter mt-8 max-w-[42rem] text-blak-body text-blak-text-2"
          style={{ animationDelay: '0.12s', animationDuration: '0.45s' }}
        >
          {t('body')}
        </p>

        <div
          className="landing-hero-enter mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          style={{ animationDelay: '0.42s' }}
        >
          <Link
            href="/login"
            className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-blak-green px-8 text-base font-semibold text-blak-black shadow-[0_0_0_1px_rgb(var(--blak-green)/0.6),0_18px_40px_-18px_rgb(var(--blak-green)/0.9)] transition-colors hover:bg-blak-green-soft"
          >
            {t('ctaPrimary')}
            <ArrowRight
              aria-hidden
              className="size-5 transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </Link>

          <a
            href="#journey"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-blak-border/25 bg-blak-glass/50 px-8 text-base font-semibold text-blak-text backdrop-blur-md transition-colors hover:border-blak-border/45 hover:bg-blak-glass/75"
          >
            {t('ctaSecondary')}
          </a>
        </div>
      </div>

      {/* Scroll affordance. Text, not an icon alone. */}
      <div
        className="landing-hero-enter pointer-events-none absolute inset-x-0 bottom-6 mx-auto flex w-full max-w-[1280px] items-center gap-2 px-4 text-xs uppercase tracking-[0.18em] text-blak-text-2 sm:px-6"
        style={{ animationDelay: '0.9s' }}
      >
        <ArrowDown aria-hidden className="size-3.5" />
        {t('scrollHint')}
      </div>
    </section>
  );
}
