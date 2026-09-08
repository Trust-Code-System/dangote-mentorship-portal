import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';
import { PublicLockup } from '@/components/public/public-lockup';

/**
 * The final transformation — the close of the narrative and the page's last CTA.
 *
 * The composition inverts the hero deliberately: the mentor is still present
 * but has stopped leading, the mentee has moved ahead, and the light that used
 * to travel *between* them is now carried by the mentee alone. The environment
 * opens from black into a green-and-gold horizon instead of receding into fog.
 *
 * All three actions point at routes that exist: `/login`, the invite-only
 * `/signup` request-access page, and `/about`.
 */
export async function SectionTransformation() {
  const t = await getTranslations('landing.transformation');

  return (
    <section
      aria-labelledby="transformation-heading"
      className="relative overflow-hidden bg-blak-black px-4 pb-32 pt-28 sm:px-6 sm:pb-40 sm:pt-36"
    >
      {/* The opening horizon. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(ellipse_80%_100%_at_50%_115%,rgb(var(--blak-green)/0.30),rgb(var(--blak-gold)/0.10)_45%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[10%] h-px bg-gradient-to-r from-transparent via-blak-gold/25 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-[1280px]">
        <ScrollReveal>
          <FinaleScene description={t('sceneDescription')} />
        </ScrollReveal>

        <h2
          id="transformation-heading"
          className="mt-16 max-w-[16ch] text-blak-hero font-extrabold text-blak-text"
        >
          <RevealText text={t('line1')} as="span" className="block" />
          <RevealText
            text={t('line2')}
            delay={0.15}
            as="span"
            className="mt-1 block font-serif font-normal italic"
            gradient
          />
        </h2>

        <ScrollReveal delay={0.1}>
          <p className="mt-8 max-w-[42rem] text-blak-body text-blak-text-2">{t('body')}</p>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/login"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-blak-green px-8 text-base font-semibold text-blak-black shadow-[0_0_0_1px_rgb(var(--blak-green)/0.6),0_18px_40px_-18px_rgb(var(--blak-green)/0.9)] transition-colors hover:bg-blak-green-soft"
            >
              {t('signIn')}
              <ArrowRight
                aria-hidden
                className="size-5 transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center rounded-full border border-blak-border/25 bg-blak-glass/50 px-8 text-base font-semibold text-blak-text backdrop-blur-md transition-colors hover:border-blak-border/45 hover:bg-blak-glass/75"
            >
              {t('requestAccess')}
            </Link>
            <Link
              href="/about"
              className="inline-flex h-14 items-center justify-center px-2 text-base font-semibold text-blak-text-2 underline-offset-4 transition-colors hover:text-blak-text hover:underline"
            >
              {t('learnMore')}
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="mt-24 flex justify-center">
            <PublicLockup markClassName="size-10" wordmarkClassName="text-lg" />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

/**
 * The closing still: mentor behind, mentee ahead and carrying the light.
 * Inline SVG — the same sculptural language as the hero, no asset.
 */
function FinaleScene({ description }: { description: string }) {

  return (
    <svg
      aria-hidden
      viewBox="0 0 900 260"
      className="h-44 w-full sm:h-56"
      preserveAspectRatio="xMidYMax meet"
    >
      <title>{description}</title>
      <defs>
        <linearGradient id="finale-mentor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--blak-gold))" stopOpacity="0.32" />
          <stop offset="100%" stopColor="rgb(var(--blak-gold))" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="finale-mentee" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--blak-green-soft))" stopOpacity="0.75" />
          <stop offset="100%" stopColor="rgb(var(--blak-green))" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Mentor — further back, dimmer, no longer leading. */}
      <g opacity="0.7">
        <ellipse cx="330" cy="120" rx="17" ry="20" fill="url(#finale-mentor)" />
        <path d="M330 144 C 362 153, 372 205, 366 244 L 294 244 C 288 205, 298 153, 330 144 Z" fill="url(#finale-mentor)" />
      </g>

      {/* Mentee — ahead, brighter, carrying the light. */}
      <g>
        <ellipse cx="560" cy="96" rx="20" ry="24" fill="url(#finale-mentee)" />
        <path d="M560 124 C 598 135, 610 196, 603 244 L 517 244 C 510 196, 522 135, 560 124 Z" fill="url(#finale-mentee)" />
        {/* The light, no longer travelling between them. */}
        <circle cx="560" cy="96" r="42" fill="rgb(var(--blak-green-soft))" fillOpacity="0.10" />
        <circle cx="560" cy="96" r="42" fill="none" stroke="rgb(var(--blak-green-soft))" strokeOpacity="0.25" className="landing-pulse-ring" style={{ transformOrigin: '560px 96px' }} />
      </g>

      {/* The horizon they are walking into. */}
      <line x1="0" y1="244" x2="900" y2="244" stroke="rgb(var(--blak-gold))" strokeOpacity="0.28" />
    </svg>
  );
}
