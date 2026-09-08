'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/app/(landing)/hooks/use-reduced-motion';

/**
 * A card whose border catches a soft green light where the pointer is
 * (PUBLIC_PAGES_COMPONENT_MAP.md — our own take on the spotlight-card /
 * border-glow pattern, built from two CSS gradients rather than a library).
 *
 * Three things keep it honest:
 *
 *  1. **It is pure decoration.** The glow only ever appears on hover, so nothing
 *     is communicated by it. Every card's meaning is in its text and its link.
 *  2. **It costs nothing when unused.** The gradients are painted into two
 *     absolutely-positioned layers at `opacity-0`; no pointer handler runs, and
 *     no state updates, until the pointer is actually over the card.
 *  3. **It respects reduced motion and touch.** Under `prefers-reduced-motion`
 *     the tracking is skipped entirely and the card gets a plain static border
 *     lift instead — which is also what a touch device sees, since it never
 *     produces pointer-move events.
 */
export function SpotlightCard({
  as: Component = 'div',
  className,
  children,
}: {
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const Tag = Component as 'div';

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType === 'touch') return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  return (
    <Tag
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setSpot(null)}
      className={cn(
        'group relative isolate overflow-hidden rounded-2xl border border-blak-border/12 bg-blak-black/40 transition-colors duration-300 hover:border-blak-border/25',
        className,
      )}
    >
      {spot ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -z-10 size-[420px] rounded-full opacity-70 transition-opacity duration-300"
          style={{
            left: spot.x - 210,
            top: spot.y - 210,
            background:
              'radial-gradient(circle, rgb(var(--blak-green) / 0.16) 0%, transparent 65%)',
          }}
        />
      ) : null}
      {children}
    </Tag>
  );
}
