import { cn } from '@/lib/utils';

/**
 * The single environmental background layer for the page
 * (LANDING_PAGE_COMPONENT_MAP.md §2 — our own equivalent of the "light rays"
 * pattern, built from CSS gradients rather than a second WebGL canvas so it
 * never competes with the hero scene for GPU or for attention).
 *
 * Two slow-drifting volumetric shafts — one green (growth), one gold
 * (experience) — plus a deep forest floor glow. Animation lives in
 * `.landing-rays` in globals.css and is frozen under reduced motion.
 */
export function LightField({
  className,
  intensity = 'default',
}: {
  className?: string;
  /** `soft` is used on the quieter editorial sections so they recede. */
  intensity?: 'default' | 'soft';
}) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className={cn(
          'landing-rays absolute inset-x-0 -top-1/4 h-[150%]',
          intensity === 'soft' && 'opacity-40',
        )}
      />
      {/* Forest floor glow — grounds the composition and keeps the bottom edge
          from going pure black against the next section. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_60%_100%_at_50%_120%,rgb(var(--blak-green)/0.14),transparent_70%)]" />
    </div>
  );
}
