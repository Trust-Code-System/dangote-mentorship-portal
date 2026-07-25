'use client';

import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ShieldAlert, Sparkles } from 'lucide-react';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';
import { GlassPanel } from '../visuals/glass-panel';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

/**
 * Weights taken from the real engine's `DEFAULT_WEIGHTS`
 * (src/features/matching/engine.ts). Kept as a literal rather than imported so
 * this public marketing page never pulls server matching code into the client
 * bundle — the unit test in tests/landing asserts the two stay in step.
 */
const CRITERIA = [
  { key: 'competency', weight: 30 },
  { key: 'careerGoal', weight: 25 },
  { key: 'experience', weight: 20 },
  { key: 'department', weight: 10 },
  { key: 'availability', weight: 10 },
  { key: 'personality', weight: 5 },
] as const;

type CriterionKey = (typeof CRITERIA)[number]['key'];
type DemoLanguage = 'EN' | 'FR';

/** Fictional demonstration profiles. Nothing here touches real participant data. */
const MENTORS = [
  { id: 'mentorA', language: 'EN' as DemoLanguage },
  { id: 'mentorB', language: 'FR' as DemoLanguage },
  { id: 'mentorC', language: 'EN' as DemoLanguage },
  { id: 'mentorD', language: 'FR' as DemoLanguage },
];

const MENTEES = [
  { id: 'menteeA', language: 'EN' as DemoLanguage },
  { id: 'menteeB', language: 'EN' as DemoLanguage },
  { id: 'menteeC', language: 'FR' as DemoLanguage },
];

/** Suggested pairings per programme language, best first. */
const SUGGESTIONS: Record<DemoLanguage, { mentor: string; mentee: string; score: number }[]> = {
  EN: [
    { mentor: 'mentorA', mentee: 'menteeA', score: 92 },
    { mentor: 'mentorC', mentee: 'menteeB', score: 78 },
    { mentor: 'mentorA', mentee: 'menteeB', score: 71 },
  ],
  FR: [
    { mentor: 'mentorB', mentee: 'menteeC', score: 86 },
    { mentor: 'mentorD', mentee: 'menteeC', score: 74 },
  ],
};

/**
 * The AI-assisted matching chapter.
 *
 * A controlled, simulated demonstration (brief §11): visitors switch the
 * programme language and the scoring criterion and watch the network respond —
 * cross-language pairings vanish, the remaining ones are scored, one is
 * proposed, and nothing becomes active until a human approves it.
 *
 * It is fully keyboard operable: the criteria are a real tablist with roving
 * focus and arrow-key navigation, and the language control is a labelled
 * pressed-button pair. The language rejection is never communicated by colour
 * alone — ineligible nodes are also struck through and carry explicit text.
 */
export function SectionMatching() {
  const t = useTranslations('landing.matching');
  const reduced = useReducedMotion();

  const [language, setLanguage] = useState<DemoLanguage>('EN');
  const [criterion, setCriterion] = useState<CriterionKey>('competency');
  const [approved, setApproved] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const suggestions = SUGGESTIONS[language];
  // Both language tables are non-empty by construction; the fallback keeps the
  // component total rather than relying on that invariant at runtime.
  const focus = suggestions[0] ?? { mentor: '', mentee: '', score: 0 };

  const eligibleMentors = useMemo(
    () => MENTORS.filter((mentor) => mentor.language === language).map((mentor) => mentor.id),
    [language],
  );
  const eligibleMentees = useMemo(
    () => MENTEES.filter((mentee) => mentee.language === language).map((mentee) => mentee.id),
    [language],
  );

  function switchLanguage(next: DemoLanguage) {
    setLanguage(next);
    setApproved(false);
  }

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    const last = CRITERIA.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    const target = CRITERIA[next];
    if (!target) return;
    setCriterion(target.key);
    tabRefs.current[next]?.focus();
  }

  return (
    <section
      id="matching"
      aria-labelledby="matching-heading"
      className="relative overflow-hidden bg-blak-forest px-4 py-28 sm:px-6 sm:py-36"
    >
      {/* Section bed: a single soft green wash, no second animated background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgb(var(--blak-green)/0.12),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-[1280px]">
        <div className="max-w-3xl">
          <ScrollReveal>
            <p className="text-blak-label uppercase text-blak-green-soft">{t('eyebrow')}</p>
          </ScrollReveal>
          <h2 id="matching-heading" className="mt-6 text-blak-statement text-blak-text">
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

        {/* ── The hard rule. Given its own weight because it is the single most
            important guarantee in the engine. ── */}
        <ScrollReveal delay={0.1} className="mt-14">
          <GlassPanel className="border-blak-gold/25 bg-blak-gold/[0.06] p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-blak-gold/15 text-blak-gold">
                <ShieldAlert className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-blak-label uppercase text-blak-gold">{t('hardRuleLabel')}</p>
                <h3 className="mt-2 font-serif text-2xl italic text-blak-text sm:text-3xl">
                  {t('hardRuleTitle')}
                </h3>
                <p className="mt-3 max-w-2xl text-blak-body text-blak-text-2">{t('hardRuleBody')}</p>
              </div>
            </div>
          </GlassPanel>
        </ScrollReveal>

        {/* ── Interactive demonstration ── */}
        <ScrollReveal delay={0.05} className="mt-10">
          <GlassPanel className="p-5 sm:p-8">
            <div className="flex flex-col gap-5 border-b border-blak-border/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-blak-label uppercase text-blak-text-2">{t('demoLabel')}</p>
                <p className="mt-2 max-w-md text-sm text-blak-text-2">{t('demoHint')}</p>
              </div>

              <fieldset className="shrink-0">
                <legend className="mb-2 text-blak-label uppercase text-blak-text-2">
                  {t('languageLabel')}
                </legend>
                <div className="inline-flex rounded-full border border-blak-border/15 p-1">
                  {(['EN', 'FR'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => switchLanguage(code)}
                      aria-pressed={language === code}
                      className={cn(
                        'rounded-full px-5 py-2 text-sm font-semibold transition-colors',
                        language === code
                          ? 'bg-blak-green text-blak-black'
                          : 'text-blak-text-2 hover:text-blak-text',
                      )}
                    >
                      {code === 'EN' ? t('languageEn') : t('languageFr')}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Criteria tablist */}
            <div className="mt-6">
              <p id="criteria-label" className="text-blak-label uppercase text-blak-text-2">
                {t('criteriaLabel')}
              </p>
              <div
                role="tablist"
                aria-labelledby="criteria-label"
                className="mt-3 flex flex-wrap gap-2"
              >
                {CRITERIA.map((item, index) => {
                  const isActive = criterion === item.key;
                  return (
                    <button
                      key={item.key}
                      ref={(node) => {
                        tabRefs.current[index] = node;
                      }}
                      role="tab"
                      type="button"
                      id={`criterion-tab-${item.key}`}
                      aria-selected={isActive}
                      aria-controls="criterion-panel"
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => setCriterion(item.key)}
                      onKeyDown={(event) => onTabKeyDown(event, index)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                        isActive
                          ? 'border-blak-green/60 bg-blak-green/15 text-blak-text'
                          : 'border-blak-border/15 text-blak-text-2 hover:border-blak-border/30 hover:text-blak-text',
                      )}
                    >
                      {t(`criteria.${item.key}`)}
                      <span
                        className={cn(
                          'tabular-nums text-xs font-semibold',
                          isActive ? 'text-blak-green-soft' : 'text-blak-text-2/70',
                        )}
                      >
                        {item.weight}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Network + rationale */}
            <div
              role="tabpanel"
              id="criterion-panel"
              aria-labelledby={`criterion-tab-${criterion}`}
              className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]"
            >
              <MatchNetwork
                language={language}
                eligibleMentors={eligibleMentors}
                eligibleMentees={eligibleMentees}
                suggestions={suggestions}
                approved={approved}
                reduced={reduced}
              />

              <div className="flex flex-col">
                <p className="text-blak-label uppercase text-blak-text-2">{t('rationaleLabel')}</p>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={`${language}-${criterion}`}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 text-blak-body text-blak-text"
                  >
                    {t(`rationale.${criterion}`)}
                  </motion.p>
                </AnimatePresence>

                <div className="mt-6 rounded-xl border border-blak-border/12 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-blak-text-2">{t('scoreLabel')}</span>
                    <span className="font-display text-3xl font-bold tabular-nums text-blak-green-soft">
                      {focus.score}
                      <span className="text-base text-blak-text-2">/100</span>
                    </span>
                  </div>
                  <div
                    role="presentation"
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-blak-ivory/10"
                  >
                    <motion.span
                      className="block h-full rounded-full bg-gradient-to-r from-blak-green to-blak-green-soft"
                      initial={reduced ? false : { width: 0 }}
                      whileInView={{ width: `${focus.score}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                      style={reduced ? { width: `${focus.score}%` } : undefined}
                    />
                  </div>
                </div>

                {/* The approval beat — the connection is not active until a
                    human says so. */}
                <div className="mt-5 rounded-xl border border-blak-border/12 p-4">
                  {approved ? (
                    <p className="flex items-center gap-2 text-sm font-semibold text-blak-green-soft">
                      <Check className="size-4" aria-hidden />
                      {t('approvedLabel')}
                    </p>
                  ) : (
                    <>
                      <p className="flex items-center gap-2 text-sm text-blak-text-2">
                        <Sparkles className="size-4 text-blak-gold" aria-hidden />
                        {t('pendingLabel')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setApproved(true)}
                        className="mt-3 w-full rounded-full bg-blak-green px-5 py-2.5 text-sm font-semibold text-blak-black transition-colors hover:bg-blak-green-soft"
                      >
                        {/* Labelled as a simulation, not an action: this is a
                            public page and nothing here touches real data. */}
                        {t('approveCta')}
                      </button>
                    </>
                  )}
                </div>

                <p className="mt-5 text-xs leading-relaxed text-blak-text-2/80">{t('disclaimer')}</p>
              </div>
            </div>
          </GlassPanel>
        </ScrollReveal>
      </div>
    </section>
  );
}

/**
 * The candidate network.
 *
 * Two columns of anonymous profile cards with connector curves drawn behind
 * them. The endpoints are **measured from the live DOM** rather than assumed
 * from row indices: the two columns hold different numbers of cards, cards grow
 * or shrink with their text, and French copy runs ~20% longer, so any
 * index-derived geometry drifts out of alignment the moment the layout changes.
 * A ResizeObserver keeps the curves attached to the cards at every width and in
 * both languages.
 *
 * The curves are decorative — every relationship they draw is also stated in
 * the rationale panel and the score beside it.
 */
function MatchNetwork({
  language,
  eligibleMentors,
  eligibleMentees,
  suggestions,
  approved,
  reduced,
}: {
  language: DemoLanguage;
  eligibleMentors: string[];
  eligibleMentees: string[];
  suggestions: { mentor: string; mentee: string; score: number }[];
  approved: boolean;
  reduced: boolean;
}) {
  const t = useTranslations('landing.matching');

  const frameRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [centres, setCentres] = useState<Record<string, { x: number; y: number }>>({});

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const frameRect = frame.getBoundingClientRect();
      const next: Record<string, { x: number; y: number }> = {};

      for (const [id, node] of Object.entries(nodeRefs.current)) {
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const isMentor = id.startsWith('mentor');
        next[id] = {
          // Curves leave a mentor from its right edge and arrive at a mentee on
          // its left edge.
          x: (isMentor ? rect.right : rect.left) - frameRect.left,
          y: rect.top + rect.height / 2 - frameRect.top,
        };
      }

      setBox({ width: frameRect.width, height: frameRect.height });
      setCentres(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
    // Language changes card copy (and therefore card heights), so re-measure.
  }, [language]);

  const registerNode = (id: string) => (node: HTMLLIElement | null) => {
    nodeRefs.current[id] = node;
  };

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-6 sm:gap-12">
        <p className="text-blak-label uppercase text-blak-text-2">{t('mentorsLabel')}</p>
        <p className="text-blak-label uppercase text-blak-text-2">{t('menteesLabel')}</p>
      </div>

      {/* The measured frame contains exactly the two card columns, so the SVG
          overlay and the card coordinates share one origin. */}
      <div ref={frameRef} className="relative grid grid-cols-2 gap-6 sm:gap-12">
        <ul className="flex flex-col gap-3">
          {MENTORS.map((mentor) => (
            <ProfileNode
              key={mentor.id}
              ref={registerNode(mentor.id)}
              label={t(`profiles.${mentor.id}`)}
              language={mentor.language}
              eligible={eligibleMentors.includes(mentor.id)}
              rejectedLabel={t('rejectedLabel')}
              reduced={reduced}
            />
          ))}
        </ul>

        <ul className="flex flex-col gap-3">
          {MENTEES.map((mentee) => (
            <ProfileNode
              key={mentee.id}
              ref={registerNode(mentee.id)}
              label={t(`profiles.${mentee.id}`)}
              language={mentee.language}
              eligible={eligibleMentees.includes(mentee.id)}
              rejectedLabel={t('rejectedLabel')}
              reduced={reduced}
            />
          ))}
        </ul>

        {box.width > 0 && (
          <svg
            aria-hidden
            viewBox={`0 0 ${box.width} ${box.height}`}
            width={box.width}
            height={box.height}
            className="pointer-events-none absolute inset-0"
          >
            {suggestions.map((pair, index) => {
              const from = centres[pair.mentor];
              const to = centres[pair.mentee];
              if (!from || !to) return null;

              const isFocus = index === 0;
              // Horizontal control points give a clean S-curve across the gap
              // without the line ever doubling back on itself.
              const midpoint = (from.x + to.x) / 2;

              return (
                <path
                  key={`${language}-${pair.mentor}-${pair.mentee}`}
                  d={`M ${from.x} ${from.y} C ${midpoint} ${from.y}, ${midpoint} ${to.y}, ${to.x} ${to.y}`}
                  fill="none"
                  stroke={
                    isFocus && approved
                      ? 'rgb(var(--blak-green))'
                      : isFocus
                        ? 'rgb(var(--blak-gold))'
                        : 'rgb(var(--blak-ivory))'
                  }
                  strokeOpacity={isFocus ? 0.9 : 0.16}
                  strokeWidth={isFocus ? 2 : 1}
                  strokeDasharray={isFocus && !approved ? '5 5' : undefined}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

const ProfileNode = forwardRef<
  HTMLLIElement,
  {
    label: string;
    language: DemoLanguage;
    eligible: boolean;
    rejectedLabel: string;
    reduced: boolean;
  }
>(function ProfileNode({ label, language, eligible, rejectedLabel, reduced }, ref) {
  return (
    <motion.li
      ref={ref}
      animate={{ opacity: eligible ? 1 : 0.35 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4 }}
      className={cn(
        'relative z-10 rounded-xl border px-3 py-3 backdrop-blur-sm',
        eligible
          ? 'border-blak-green/30 bg-blak-forest-2/80'
          : 'border-blak-border/10 bg-blak-black/60',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider',
            eligible ? 'bg-blak-green/20 text-blak-green-soft' : 'bg-blak-ivory/10 text-blak-text-2',
          )}
        >
          {language}
        </span>
      </div>
      <p
        className={cn(
          'mt-1.5 text-xs leading-snug sm:text-sm',
          eligible ? 'text-blak-text' : 'text-blak-text-2 line-through decoration-blak-text-2/50',
        )}
      >
        {label}
      </p>
      {/* Not colour alone: ineligible nodes say why, in words. */}
      {!eligible && <p className="mt-1 text-[0.65rem] text-blak-text-2/80">{rejectedLabel}</p>}
    </motion.li>
  );
});
