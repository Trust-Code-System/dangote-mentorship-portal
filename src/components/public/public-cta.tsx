import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { RevealText } from '@/app/(landing)/motion/reveal-text';
import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';
import { cn } from '@/lib/utils';

export interface PublicCtaAction {
  href: string;
  label: string;
  /** Exactly one action per band should be `primary`. */
  variant?: 'primary' | 'secondary' | 'quiet';
}

/**
 * The closing band every Knowledge Library page ends on.
 *
 * One filled action, one outlined, and one quiet text link — a clear order of
 * preference rather than three equal buttons, which is how a CTA row ends up
 * meaning nothing. Every action is a real route; there are no dead buttons on
 * these pages.
 */
export function PublicCTA({
  title,
  accent,
  body,
  actions,
  className,
}: {
  title: string;
  accent?: string;
  body?: string;
  actions: PublicCtaAction[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden bg-blak-black px-4 py-28 sm:px-6 sm:py-32',
        className,
      )}
    >
      {/* A single low green bloom behind the copy — the page exhaling. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_55%_100%_at_50%_115%,rgb(var(--blak-green)/0.16),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-[1280px] text-center">
        <h2 className="mx-auto max-w-4xl text-blak-statement text-blak-text">
          <RevealText text={title} as="span" className="block" />
          {accent ? (
            <RevealText
              text={accent}
              delay={0.12}
              as="span"
              className="block font-serif font-normal italic text-blak-gold-soft"
            />
          ) : null}
        </h2>

        {body ? (
          <ScrollReveal delay={0.1}>
            <p className="mx-auto mt-7 max-w-[60ch] text-blak-body text-blak-text-2">{body}</p>
          </ScrollReveal>
        ) : null}

        <ScrollReveal delay={0.16}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            {actions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className={cn(
                  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold transition-colors sm:w-auto',
                  action.variant === 'primary' &&
                    'bg-blak-green text-blak-black hover:bg-blak-green-soft',
                  action.variant === 'secondary' &&
                    'border border-blak-border/25 text-blak-text hover:border-blak-border/50 hover:bg-blak-ivory/5',
                  (!action.variant || action.variant === 'quiet') &&
                    'text-blak-text-2 hover:text-blak-text',
                )}
              >
                {action.label}
                {action.variant === 'primary' ? <ArrowRight className="size-4" aria-hidden /> : null}
              </Link>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
