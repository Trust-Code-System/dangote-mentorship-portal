import { cn } from '@/lib/utils';

/**
 * A bordered aside for a caveat, a note or a limit — the places where being
 * precise matters more than being persuasive.
 *
 * Rendered as a real `<aside>` so assistive technology can skip it, and given a
 * gold or green rule rather than a coloured background, because a filled tint
 * on a dark surface reads as an error state.
 */
export function PublicCallout({
  title,
  tone = 'gold',
  surface = 'dark',
  className,
  children,
}: {
  title?: string;
  /** `gold` = something to be aware of · `green` = something that is guaranteed. */
  tone?: 'gold' | 'green';
  surface?: 'dark' | 'light';
  className?: string;
  children: React.ReactNode;
}) {
  const rule = tone === 'gold' ? 'border-blak-gold/50' : 'border-blak-green/60';

  return (
    <aside
      className={cn(
        'border-l-2 pl-5 sm:pl-6',
        rule,
        surface === 'light' ? 'text-blak-forest-2/85' : 'text-blak-text-2',
        className,
      )}
    >
      {title ? (
        <h3
          className={cn(
            'text-sm font-semibold',
            surface === 'light' ? 'text-blak-forest' : 'text-blak-text',
          )}
        >
          {title}
        </h3>
      ) : null}
      <div className={cn('max-w-[68ch] text-sm leading-relaxed', title && 'mt-2')}>{children}</div>
    </aside>
  );
}
