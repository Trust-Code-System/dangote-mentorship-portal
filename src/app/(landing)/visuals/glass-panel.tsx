import { cn } from '@/lib/utils';

/**
 * The landing page's dark glass surface — the only place glassmorphism is used
 * (spec §3: glass is for interface surfaces sitting above the cinematic scene,
 * not for decoration). Used by the floating nav, the tool panels and the
 * matching cards.
 *
 * A translucent forest-black plate, a hairline ivory border, a controlled blur,
 * and a single internal top highlight that reads as a light catching an edge.
 */
export function GlassPanel({
  className,
  children,
  as: Component = 'div',
  highlight = true,
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
  highlight?: boolean;
}) {
  // `React.ElementType` collapses the children prop to `never` for a fully
  // generic tag, so narrow to a concrete intrinsic element for JSX.
  const Tag = Component as 'div';

  return (
    <Tag
      className={cn(
        'relative overflow-hidden rounded-2xl border border-blak-border/12 bg-blak-glass/65 backdrop-blur-xl',
        className,
      )}
    >
      {highlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blak-ivory/25 to-transparent"
        />
      )}
      {children}
    </Tag>
  );
}
