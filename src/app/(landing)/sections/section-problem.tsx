import { getTranslations } from 'next-intl/server';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';

/**
 * The human problem statement — the quietest section on the page.
 *
 * Deliberately card-free (brief §10). The composition is type on darkness plus
 * one diagram: the two figures pushed to the far edges with the distance
 * between them made literal, and a few fragments of knowledge drifting across
 * the gap without reaching the other side. This is the "before" state of the
 * connection the hero just showed.
 */
export async function SectionProblem() {
  const t = await getTranslations('landing.problem');

  return (
    <section
      id="programme"
      aria-labelledby="problem-heading"
      className="relative overflow-hidden bg-blak-black px-4 py-28 sm:px-6 sm:py-40"
    >
      <div className="mx-auto w-full max-w-[1280px]">
        <ScrollReveal>
          <p className="text-blak-label uppercase text-blak-text-2">{t('eyebrow')}</p>
        </ScrollReveal>

        <h2 id="problem-heading" className="mt-8 max-w-[20ch] text-blak-statement text-blak-text">
          <RevealText text={t('line1')} as="span" className="block" />
          <RevealText
            text={t('line2')}
            delay={0.15}
            as="span"
            className="mt-3 block font-serif font-normal italic text-blak-text-2"
          />
        </h2>

        {/* The distance made literal. */}
        <ScrollReveal delay={0.15} className="mt-16 sm:mt-20">
          <div className="relative">
            <div className="flex items-end justify-between gap-6">
              <FigureMark label={t('experienceLabel')} tone="gold" />
              <FigureMark label={t('ambitionLabel')} tone="green" align="right" />
            </div>

            {/* The gap. Fragments leave the mentor and fade before they arrive —
                knowledge that never completes the crossing. */}
            <div className="pointer-events-none absolute inset-x-[18%] bottom-8 hidden items-center gap-2 sm:flex">
              <span className="h-px flex-1 bg-gradient-to-r from-blak-gold/40 via-blak-ivory/8 to-transparent" />
              <span className="h-px flex-1 bg-gradient-to-l from-blak-green/25 via-blak-ivory/8 to-transparent" />
            </div>
            <p className="mt-6 text-center text-xs uppercase tracking-[0.18em] text-blak-text-2/70">
              {t('gapLabel')}
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-20 grid gap-8 border-t border-blak-border/10 pt-12 md:grid-cols-2 md:gap-16">
          <ScrollReveal>
            <p className="text-blak-body text-blak-text-2">{t('body')}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="font-serif text-2xl italic leading-snug text-blak-text sm:text-3xl">
              {t('close')}
            </p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

/** Abstract silhouette + label. Same sculptural language as the 3D forms. */
function FigureMark({
  label,
  tone,
  align = 'left',
}: {
  label: string;
  tone: 'gold' | 'green';
  align?: 'left' | 'right';
}) {
  const color = tone === 'gold' ? 'rgb(var(--blak-gold))' : 'rgb(var(--blak-green))';

  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <svg
        aria-hidden
        viewBox="0 0 80 120"
        className={`h-24 w-16 sm:h-32 sm:w-20 ${align === 'right' ? 'ml-auto' : ''}`}
      >
        <defs>
          <linearGradient id={`figure-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <ellipse cx="40" cy="22" rx="13" ry="15" fill={`url(#figure-${tone})`} />
        <path d="M40 40 C 62 48, 70 88, 66 120 L 14 120 C 10 88, 18 48, 40 40 Z" fill={`url(#figure-${tone})`} />
      </svg>
      <p className="mt-3 text-blak-label uppercase" style={{ color }}>
        {label}
      </p>
    </div>
  );
}
