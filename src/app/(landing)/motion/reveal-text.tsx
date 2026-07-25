'use client';

import { useInView } from '../hooks/use-in-view';
import { cn } from '@/lib/utils';

/**
 * Masked per-word reveal for section headings
 * (LANDING_PAGE_COMPONENT_MAP.md §2, our equivalent of the split-text pattern).
 *
 * Words rise out of an overflow mask with a short blur, staggered just enough
 * to read as one movement rather than a queue. Same visual result as the hero's
 * `HeroRevealText`, but triggered when the heading scrolls into view instead of
 * at first paint.
 *
 * Three details that are easy to get wrong and are deliberate here:
 *
 *  1. **The observer watches the un-transformed container, not the words.**
 *     Each word starts translated fully below its own `overflow-hidden` mask,
 *     so an observer attached to a word would measure a clipped, zero-area rect
 *     and never fire — leaving the heading permanently invisible.
 *  2. **The sentence stays one accessible string.** The visual split is
 *     `aria-hidden` and the real text is exposed via an `sr-only` copy, so
 *     assistive technology reads a sentence rather than fragments. The animated
 *     copy is `select-none`, so selecting the heading does not pick up the
 *     duplicate.
 *  3. **The gradient goes on the line, never on the words.** Per-word it
 *     restarts on every word and reads as a repeating multi-hue stripe —
 *     precisely the rainbow gradient the brief rules out.
 *
 * CSS-driven for the same reason as `ScrollReveal`: cheaper on the main thread,
 * and the reduced-motion and no-JS behaviour both fall out of globals.css.
 */
export function RevealText({
  text,
  className,
  delay = 0,
  as: Component = 'span',
  gradient = false,
}: {
  text: string;
  className?: string;
  /** Seconds before the first word begins. */
  delay?: number;
  as?: React.ElementType;
  /** The single green→gold light treatment, applied across the whole line. */
  gradient?: boolean;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.2);
  const Tag = Component as 'span';
  const words = text.split(' ');

  // A gradient line is animated as a single element with opacity alone. Any
  // per-word wrapper that creates a stacking context — transform, filter,
  // will-change — stops `background-clip: text` reaching the glyphs and the
  // line disappears entirely. See `.landing-line-reveal` in globals.css.
  if (gradient) {
    return (
      <Tag
        ref={ref}
        className={cn(
          className,
          'landing-line-reveal bg-gradient-to-r from-blak-green-soft via-blak-ivory to-blak-gold bg-clip-text text-transparent',
          inView && 'is-visible',
        )}
        style={{ animationDelay: `${delay}s` }}
      >
        {text}
      </Tag>
    );
  }

  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      <span
        ref={ref}
        aria-hidden
        className={cn('landing-reveal-text inline select-none', inView && 'is-visible')}
      >
        {words.map((word, index) => (
          // The space sits outside the mask: inside an `overflow-hidden`
          // inline-block it collapses as trailing whitespace and the words run
          // together.
          <span key={`${word}-${index}`}>
            <span className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em]">
              <span
                className="landing-word inline-block"
                style={{ animationDelay: `${delay + index * 0.055}s` }}
              >
                {word}
              </span>
            </span>
            {index < words.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    </Tag>
  );
}
