import { PublicBreadcrumb } from './public-breadcrumb';
import { HeroRevealText } from '@/app/(landing)/motion/hero-reveal-text';
import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';
import { cn } from '@/lib/utils';

/**
 * The shared hero for every Knowledge Library page
 * (PUBLIC_PAGES_MASTER_SPEC.md §6).
 *
 * Structure is fixed — eyebrow, breadcrumb, h1, lede, a rule that grows in —
 * so the four pages read as chapters of one book. Only the motif behind it
 * changes, and each page supplies its own.
 *
 * Sized 420–620px on desktop and ~300–460px on mobile via padding rather than a
 * fixed height, so the block grows with a long French headline instead of
 * clipping it. It is deliberately **not** `100vh`: a full-viewport hero on a
 * secondary page just delays the content, and the landing page keeps that
 * treatment to itself.
 *
 * The h1 uses the hero variant of the word-mask reveal, which animates on first
 * paint from CSS. That matters here: the h1 is the Largest Contentful Paint
 * element on every one of these pages, so it must not wait for hydration.
 */
export function PublicPageHero({
  eyebrow,
  title,
  titleAccent,
  lede,
  breadcrumbLabel,
  motif,
  className,
}: {
  eyebrow: string;
  title: string;
  /** Rendered in the editorial serif, on its own line. Optional. */
  titleAccent?: string;
  lede: string;
  breadcrumbLabel: string;
  /** Page-specific decorative background. Must be `aria-hidden`. */
  motif?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden bg-blak-black px-4 pb-20 pt-32 sm:px-6 sm:pb-24 sm:pt-36 lg:pb-28 lg:pt-44',
        className,
      )}
    >
      {motif}

      {/* Keeps the copy legible whatever the motif is doing behind it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_20%_40%,rgb(var(--blak-black)/0.85),transparent_75%)]"
      />

      <div className="relative mx-auto w-full max-w-[1280px]">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <p className="text-blak-label uppercase text-blak-green-soft">{eyebrow}</p>
            <PublicBreadcrumb label={breadcrumbLabel} />
          </div>

          <h1 className="mt-5 text-blak-hero text-blak-text">
            <HeroRevealText text={title} className="block" />
            {titleAccent ? (
              <HeroRevealText
                text={titleAccent}
                delay={0.18}
                className="block font-serif font-normal italic text-blak-gold-soft"
              />
            ) : null}
          </h1>

          <ScrollReveal delay={0.12}>
            <p className="mt-8 max-w-[62ch] text-blak-body text-blak-text-2">{lede}</p>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            {/* The decorative rule: grows out of the left edge under the lede. */}
            <span
              aria-hidden
              className="mt-10 block h-px w-40 bg-gradient-to-r from-blak-green via-blak-gold/60 to-transparent"
            />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
