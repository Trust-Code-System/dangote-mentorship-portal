'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

/**
 * The nine stages, verified against the application itself — `home.journey.nodes`
 * in messages/*.json and the authenticated journey rail. A unit test in
 * tests/landing pins this list so the marketing page can never drift from the
 * programme the portal actually runs.
 */
const STAGES = [
  'profile',
  'training',
  'matched',
  'agreement',
  'goals',
  'sessions',
  'midterm',
  'final',
  'certificate',
] as const;

/**
 * Scroll distance allotted to each stage while pinned. 55vh is the balance
 * point found by testing: long enough that a stage never flashes past before it
 * can be read, short enough that nine of them do not turn the page into an
 * endurance test.
 */
const SCROLL_PER_STAGE_VH = 55;

/**
 * The nine-month journey — the page's central scroll narrative.
 *
 * **Desktop:** one pinned chapter. GSAP ScrollTrigger owns the pin and reports
 * scroll progress; React state derived from that progress drives the content,
 * and Motion animates the content. GSAP and Motion therefore never touch the
 * same element (spec §4).
 *
 * **Mobile and reduced motion:** no pin, no scroll hijacking. The same nine
 * stages render as a plain vertical stack down a progress line, all content
 * present and readable. This is a different component tree, not a shrunken
 * desktop one (brief §22).
 */
export function SectionJourney() {
  const t = useTranslations('landing.journey');
  const reduced = useReducedMotion();
  const [pinned, setPinned] = useState(false);
  const [index, setIndex] = useState(0);

  const sectionRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  // Only pin on a large viewport with motion allowed.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setPinned(query.matches && !reduced);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [reduced]);

  useEffect(() => {
    if (!pinned) return;
    let revert: (() => void) | undefined;
    let cancelled = false;

    // GSAP is imported here rather than at module scope so it is only fetched
    // by visitors who actually get the pinned experience (spec §9).
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top top',
          end: `+=${STAGES.length * SCROLL_PER_STAGE_VH}%`,
          pin: pinRef.current,
          pinSpacing: true,
          scrub: true,
          // Progress → stage index. Clamped so the last stage holds rather than
          // overflowing to an undefined entry at progress === 1.
          onUpdate: (self) => {
            const next = Math.min(STAGES.length - 1, Math.floor(self.progress * STAGES.length));
            setIndex(next);
          },
        });
      }, sectionRef);

      // Web fonts and the 3D canvas can change layout after first paint;
      // recompute once things have settled so the pin starts in the right place.
      const timer = window.setTimeout(() => ScrollTrigger.refresh(), 400);

      revert = () => {
        window.clearTimeout(timer);
        context.revert();
      };
    })();

    return () => {
      cancelled = true;
      revert?.();
    };
  }, [pinned]);

  const heading = (
    <div className="max-w-3xl">
      <ScrollReveal>
        <p className="text-blak-label uppercase text-blak-green-soft">{t('eyebrow')}</p>
      </ScrollReveal>
      <h2 id="journey-heading" className="mt-6 text-blak-statement text-blak-text">
        <RevealText text={t('title')} as="span" className="block" />
        <RevealText
          text={t('titleAccent')}
          delay={0.12}
          as="span"
          className="block font-serif font-normal italic text-blak-gold"
        />
      </h2>
      <ScrollReveal delay={0.1}>
        <p className="mt-7 text-blak-body text-blak-text-2">{t('body')}</p>
      </ScrollReveal>
    </div>
  );

  return (
    <section
      id="journey"
      aria-labelledby="journey-heading"
      className="relative bg-blak-black px-4 py-28 sm:px-6 sm:py-36"
    >
      <div className="mx-auto w-full max-w-[1280px]">{heading}</div>

      {pinned ? (
        <div ref={sectionRef} className="mt-16">
          <div ref={pinRef} className="flex h-[100svh] items-center">
            <div className="mx-auto w-full max-w-[1280px]">
              <JourneyStage index={index} />
              <JourneyPath index={index} />
            </div>
          </div>
        </div>
      ) : (
        <JourneyStack />
      )}
    </section>
  );
}

/** The active stage's content, cross-faded as the index changes. */
function JourneyStage({ index }: { index: number }) {
  const t = useTranslations('landing.journey');
  const stage = STAGES[index];

  return (
    <div className="grid min-h-[21rem] gap-10 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-16">
      {/* Decorative restatement of "Stage N of 9". Held at 60% gold rather than
          something dimmer so it still clears 3:1 against black — large
          decorative text is exactly where contrast tends to get waived, and it
          costs nothing to pass here. */}
      <p
        aria-hidden
        className="font-serif text-[7rem] leading-none text-blak-gold/60 xl:text-[9rem]"
      >
        {String(index + 1).padStart(2, '0')}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <p className="text-blak-label uppercase text-blak-text-2">
            {t('progressLabel', { current: index + 1, total: STAGES.length })}
          </p>
          <h3 className="mt-4 font-serif text-4xl italic text-blak-text xl:text-5xl">
            {t(`stages.${stage}.title`)}
          </h3>
          <p className="mt-5 text-blak-body text-blak-text-2">{t(`stages.${stage}.body`)}</p>

          {/* The interface fragment for this stage — the state the portal would
              actually be showing at this point in the programme. */}
          <div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-blak-border/15 bg-blak-glass/60 px-4 py-2.5 backdrop-blur-sm">
            <span aria-hidden className="size-1.5 rounded-full bg-blak-green-soft" />
            <span className="text-sm text-blak-text-2">{t(`stages.${stage}.fragment`)}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * The path itself: the hero's connection, now a route through nine milestones.
 * Completed milestones settle to gold (experience banked), the current one
 * burns green (active growth), and the two figures travel the line — with the
 * mentee pulling ahead by the final stage.
 */
function JourneyPath({ index }: { index: number }) {
  const t = useTranslations('landing.journey');
  const progress = index / (STAGES.length - 1);

  return (
    <div className="mt-14">
      <div className="relative h-24">
        {/* Base line + filled progress. */}
        <div className="absolute inset-x-0 top-8 h-px bg-blak-ivory/12" />
        <motion.div
          className="absolute left-0 top-8 h-px bg-gradient-to-r from-blak-gold via-blak-green to-blak-green-soft"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Milestones */}
        <ul className="absolute inset-x-0 top-0 flex items-start justify-between">
          {STAGES.map((stage, stageIndex) => {
            const isDone = stageIndex < index;
            const isCurrent = stageIndex === index;
            return (
              <li key={stage} className="flex w-24 flex-col items-center gap-3">
                <span className="relative mt-[1.6rem] block">
                  {isCurrent && (
                    <span
                      aria-hidden
                      className="landing-pulse-ring absolute -inset-2 rounded-full border border-blak-green"
                    />
                  )}
                  <span
                    className={cn(
                      'block size-3 rounded-full transition-colors duration-500',
                      isCurrent
                        ? 'bg-blak-green-soft shadow-[0_0_16px_2px_rgb(var(--blak-green)/0.7)]'
                        : isDone
                          ? 'bg-blak-gold'
                          : 'bg-blak-ivory/25',
                    )}
                  />
                </span>
                <span
                  className={cn(
                    'text-center text-[0.7rem] leading-tight transition-colors duration-500',
                    isCurrent ? 'text-blak-text' : 'text-blak-text-2/70',
                  )}
                >
                  {t(`stages.${stage}.title`)}
                </span>
              </li>
            );
          })}
        </ul>

        {/* The two travellers. The mentee edges ahead of the mentor across the
            second half — the whole point of the programme, shown not stated. */}
        <motion.span
          aria-hidden
          className="absolute top-[1.55rem] size-2 rounded-full bg-blak-gold/80"
          animate={{ left: `calc(${progress * 100}% - 0.25rem)` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.span
          aria-hidden
          className="absolute top-[2.3rem] size-2 rounded-full bg-blak-green-soft"
          animate={{ left: `calc(${Math.min(progress * 1.08, 1) * 100}% - 0.25rem)` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

/**
 * Mobile / reduced-motion presentation: a vertical stack down a progress line.
 * Everything is on screen and readable without any scroll choreography.
 */
function JourneyStack() {
  const t = useTranslations('landing.journey');

  return (
    <ol className="relative mx-auto mt-14 w-full max-w-[1280px] space-y-6 pl-8">
      {/* The path, vertical. */}
      <span
        aria-hidden
        className="absolute bottom-4 left-[0.4375rem] top-2 w-px bg-gradient-to-b from-blak-gold/60 via-blak-green/50 to-blak-green-soft/40"
      />
      {/* The <li> must be the direct child of the <ol> — wrapping it in
          ScrollReveal's <div> makes the list invalid, so the reveal goes
          inside the list item instead. */}
      {STAGES.map((stage, stageIndex) => (
        <li key={stage}>
          <ScrollReveal
            delay={Math.min(stageIndex * 0.03, 0.15)}
            className="relative rounded-2xl border border-blak-border/12 bg-blak-forest/60 p-5 sm:p-6"
          >
            <span
              aria-hidden
              className="absolute -left-[1.72rem] top-7 size-3 rounded-full bg-blak-green-soft ring-4 ring-blak-black"
            />
            <p className="text-blak-label uppercase text-blak-text-2">
              {t('progressLabel', { current: stageIndex + 1, total: STAGES.length })}
            </p>
            <h3 className="mt-2 font-serif text-2xl italic text-blak-text">
              {t(`stages.${stage}.title`)}
            </h3>
            <p className="mt-3 text-blak-body text-blak-text-2">{t(`stages.${stage}.body`)}</p>
            <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-blak-border/15 bg-blak-black/50 px-3.5 py-2">
              <span aria-hidden className="size-1.5 rounded-full bg-blak-green-soft" />
              <span className="text-xs text-blak-text-2">{t(`stages.${stage}.fragment`)}</span>
            </div>
          </ScrollReveal>
        </li>
      ))}
    </ol>
  );
}

export { STAGES as JOURNEY_STAGES };
