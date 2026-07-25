import { cn } from '@/lib/utils';

/**
 * Fine film grain over the whole landing page — the texture that stops large
 * black areas from banding and gives the dark surfaces a photographic quality
 * rather than a flat digital one.
 *
 * A repeating 160×160 noise tile (see `.landing-grain` in globals.css), not a
 * full-viewport SVG filter: the filter version cost seconds of render delay on
 * a throttled mobile profile because the compositor had to re-filter the whole
 * screen. No network request either — the tile is a data URI.
 *
 * Purely decorative, so it is hidden from assistive tech and never intercepts
 * pointer events.
 */
export function FilmGrain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        // No `mix-blend-mode`: blending a fixed full-viewport layer against
        // everything beneath it makes the compositor re-blend the entire screen
        // on every paint. At 4% opacity over a near-black page the visual
        // difference is imperceptible and the cost is not.
        'landing-grain pointer-events-none fixed inset-0 z-[60] opacity-[0.04]',
        className,
      )}
    />
  );
}
