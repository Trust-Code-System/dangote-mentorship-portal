'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { Target, NotebookPen, CalendarClock, MessagesSquare, BookLock, ClipboardCheck } from 'lucide-react';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';
import { GlassPanel } from '../visuals/glass-panel';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

/**
 * Only workflows that exist as real routes in this application: /goals,
 * /sessions, /meetings, /messages, /journal and the mid-term & final reviews.
 * Nothing aspirational.
 */
const TOOLS = [
  { key: 'goals', Icon: Target },
  { key: 'sessions', Icon: NotebookPen },
  { key: 'meetings', Icon: CalendarClock },
  { key: 'messages', Icon: MessagesSquare },
  { key: 'journal', Icon: BookLock },
  { key: 'reviews', Icon: ClipboardCheck },
] as const;

/**
 * What participants actually do.
 *
 * Deliberately *not* a dashboard screenshot in a floating laptop (brief §29).
 * Each workflow is a single legible glass panel — one forward at a time —
 * selected from a list, with the panel carrying a real interface fragment
 * rather than a shrunken screen. Everything stays live HTML text, so it is
 * readable at any zoom and to a screen reader.
 */
export function SectionTools() {
  const t = useTranslations('landing.tools');
  const reduced = useReducedMotion();
  const [active, setActive] = useState<(typeof TOOLS)[number]['key']>('goals');

  const ActiveIcon = TOOLS.find((tool) => tool.key === active)?.Icon ?? Target;

  return (
    <section
      id="experience"
      aria-labelledby="tools-heading"
      className="relative overflow-hidden bg-blak-forest px-4 py-28 sm:px-6 sm:py-36"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_10%,rgb(var(--blak-gold)/0.08),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-[1280px]">
        <div className="max-w-3xl">
          <ScrollReveal>
            <p className="text-blak-label uppercase text-blak-green-soft">{t('eyebrow')}</p>
          </ScrollReveal>
          <h2 id="tools-heading" className="mt-6 text-blak-statement text-blak-text">
            <RevealText text={t('title')} as="span" className="block" />
            <RevealText
              text={t('titleAccent')}
              delay={0.12}
              as="span"
              className="block font-serif font-normal italic text-blak-green-soft"
            />
          </h2>
          <ScrollReveal delay={0.1}>
            <p className="mt-7 text-blak-body text-blak-text-2">{t('body')}</p>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.05} className="mt-14">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-10">
            {/* Selector — a real list of buttons, keyboard-reachable in order.
                Not a hover-only interaction. */}
            <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {TOOLS.map((tool) => {
                const isActive = tool.key === active;
                return (
                  <li key={tool.key} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => setActive(tool.key)}
                      aria-pressed={isActive}
                      className={cn(
                        'flex w-full items-center gap-3 whitespace-nowrap rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors lg:whitespace-normal',
                        isActive
                          ? 'border-blak-green/45 bg-blak-green/12 text-blak-text'
                          : 'border-blak-border/12 text-blak-text-2 hover:border-blak-border/25 hover:text-blak-text',
                      )}
                    >
                      <tool.Icon
                        aria-hidden
                        className={cn('size-4 shrink-0', isActive ? 'text-blak-green-soft' : '')}
                      />
                      {t(`items.${tool.key}.title`)}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* The active panel. min-height stops the section from jumping as
                copy length changes between tools and between languages. */}
            <GlassPanel className="min-h-[22rem] p-6 sm:p-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-xl bg-blak-green/15 text-blak-green-soft">
                    <ActiveIcon className="size-5" aria-hidden />
                  </span>

                  <h3 className="mt-6 font-serif text-3xl italic text-blak-text">
                    {t(`items.${active}.title`)}
                  </h3>
                  <p className="mt-4 max-w-xl text-blak-body text-blak-text-2">
                    {t(`items.${active}.body`)}
                  </p>

                  {/* A real interface fragment, at full legibility. */}
                  <div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-blak-border/15 bg-blak-black/50 px-4 py-2.5">
                    <span aria-hidden className="size-1.5 rounded-full bg-blak-green-soft" />
                    <span className="text-sm text-blak-text-2">{t(`items.${active}.detail`)}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </GlassPanel>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
