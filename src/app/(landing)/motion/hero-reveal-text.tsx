import { cn } from '@/lib/utils';

/**
 * The hero headline's per-word masked reveal — **CSS only, no JavaScript**.
 *
 * Visually identical to `RevealText`, which the rest of the page uses. The
 * difference is entirely about when it can start: `RevealText` is driven by
 * Motion and therefore cannot paint until React has hydrated, which on a
 * throttled mobile profile pushed the hero's Largest Contentful Paint out to
 * 4.6s. This version is a server-rendered element with a CSS animation, so the
 * browser paints and animates it at first paint with no client bundle involved.
 *
 * Same accessibility contract as `RevealText`: the sentence is exposed once as
 * a single string, and the per-word visual split is hidden from assistive
 * technology and excluded from text selection.
 */
export function HeroRevealText({
  text,
  className,
  delay = 0,
  as: Component = 'span',
  gradient = false,
}: {
  text: string;
  className?: string;
  /** Seconds before this line begins. */
  delay?: number;
  as?: React.ElementType;
  /** The single green→gold light treatment, applied across the whole line. */
  gradient?: boolean;
}) {
  const Tag = Component as 'span';
  const words = text.split(' ');

  // A gradient line is animated as a single element with opacity alone. Any
  // per-word wrapper that creates a stacking context — transform, filter,
  // will-change — stops `background-clip: text` reaching the glyphs and the
  // line disappears entirely. See `.landing-line-fade` in globals.css.
  if (gradient) {
    return (
      <Tag
        className={cn(
          className,
          'landing-line-fade bg-gradient-to-r from-blak-green-soft via-blak-ivory to-blak-gold bg-clip-text text-transparent',
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
      <span aria-hidden className="inline select-none">
        {words.map((word, index) => (
          // The space sits outside the mask: inside an `overflow-hidden`
          // inline-block it collapses as trailing whitespace and the words run
          // together.
          <span key={`${word}-${index}`}>
            <span className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em]">
              <span
                className="landing-hero-word"
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
