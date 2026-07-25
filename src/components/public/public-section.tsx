import { RevealText } from '@/app/(landing)/motion/reveal-text';
import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';
import { cn } from '@/lib/utils';

/**
 * Surface rhythm for the Knowledge Library (PUBLIC_PAGES_MASTER_SPEC.md §5).
 *
 * The single biggest complaint about the old public pages was that every
 * section was a white card on a white page. Sections here declare a *tone*
 * instead, and the page alternates them, so scrolling has a pulse:
 *
 *  - `black`    the cinematic default
 *  - `forest`   deep green-black, for grouped content
 *  - `forest-2` a lifted forest, for the section after a forest one
 *  - `ivory`    the warm editorial "paper" band — at most one per page, and the
 *               only place the page inverts to dark ink
 */
export type SectionTone = 'black' | 'forest' | 'forest-2' | 'ivory';

const TONE_CLASS: Record<SectionTone, string> = {
  black: 'bg-blak-black text-blak-text',
  forest: 'bg-blak-forest text-blak-text',
  'forest-2': 'bg-blak-forest-2 text-blak-text',
  // Ink on ivory is 17.4:1 (globals.css records the measurement).
  ivory: 'bg-blak-ivory text-blak-forest',
};

export function PublicSection({
  tone = 'black',
  id,
  labelledBy,
  className,
  children,
}: {
  tone?: SectionTone;
  id?: string;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        'relative overflow-hidden px-4 py-24 sm:px-6 sm:py-28 lg:py-32',
        TONE_CLASS[tone],
        className,
      )}
    >
      <div className="relative mx-auto w-full max-w-[1280px]">{children}</div>
    </section>
  );
}

/**
 * The standard section opener: eyebrow, heading, optional lede.
 *
 * The heading animates with the same masked word reveal as the landing page's
 * section headings, so the two surfaces move the same way. `accent` is set in
 * the editorial serif — the second font exists for exactly this and nothing
 * else.
 */
export function PublicSectionHeading({
  id,
  eyebrow,
  title,
  accent,
  lede,
  align = 'left',
  tone = 'dark',
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  accent?: string;
  lede?: string;
  align?: 'left' | 'center';
  /** `light` flips the muted colours for the ivory band. */
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const muted = tone === 'light' ? 'text-blak-forest-2/75' : 'text-blak-text-2';
  const eyebrowColor = tone === 'light' ? 'text-blak-green-deep' : 'text-blak-green-soft';

  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow ? (
        <ScrollReveal>
          <p className={cn('text-blak-label uppercase', eyebrowColor)}>{eyebrow}</p>
        </ScrollReveal>
      ) : null}

      <h2 id={id} className={cn('text-blak-section', eyebrow && 'mt-5')}>
        <RevealText text={title} as="span" className="block" />
        {accent ? (
          <RevealText
            text={accent}
            delay={0.12}
            as="span"
            className={cn('block font-serif font-normal italic', muted)}
          />
        ) : null}
      </h2>

      {lede ? (
        <ScrollReveal delay={0.1}>
          <p className={cn('mt-6 max-w-[68ch] text-blak-body', muted, align === 'center' && 'mx-auto')}>
            {lede}
          </p>
        </ScrollReveal>
      ) : null}
    </div>
  );
}

/**
 * The editorial split: a large statement on one side, the explanation on the
 * other, joined by a line that draws itself in as the block enters view.
 *
 * Reading width on the prose column is capped at 62ch. Long-form copy stretched
 * across a 1280px viewport is the desktop version of the "narrow column in a
 * sea of white" problem — the opposite failure, equally unreadable.
 */
export function EditorialBlock({
  statement,
  children,
  tone = 'dark',
  className,
}: {
  statement: React.ReactNode;
  children: React.ReactNode;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <div className={cn('grid gap-10 lg:grid-cols-2 lg:gap-16', className)}>
      <ScrollReveal>
        <div className="relative lg:pr-8">
          <p
            className={cn(
              'text-blak-statement font-serif font-normal italic',
              tone === 'light' ? 'text-blak-forest' : 'text-blak-text',
            )}
          >
            {statement}
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.12}>
        <div className="relative">
          {/* The connection line: horizontal on desktop where the columns sit
              side by side, vertical on mobile where they stack. Decorative. */}
          <span
            aria-hidden
            className="mb-7 block h-px w-24 bg-gradient-to-r from-blak-green to-transparent lg:absolute lg:-left-8 lg:top-3 lg:mb-0 lg:h-16 lg:w-px lg:bg-gradient-to-b"
          />
          <div
            className={cn(
              'max-w-[62ch] space-y-5 text-blak-body',
              tone === 'light' ? 'text-blak-forest-2/85' : 'text-blak-text-2',
            )}
          >
            {children}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
