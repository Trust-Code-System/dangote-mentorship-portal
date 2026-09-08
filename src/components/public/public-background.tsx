import { cn } from '@/lib/utils';

/**
 * Page motifs for the Knowledge Library hero (PUBLIC_PAGES_MASTER_SPEC.md §6).
 *
 * One per page, each built from CSS gradients and inline SVG — **no WebGL, no
 * canvas, no images**. The landing page keeps the 3D scene to itself; these
 * pages have to stay lighter than it, and a decorative background is the first
 * thing that should not cost a GPU context.
 *
 * All of them are `aria-hidden` and `pointer-events-none`, and the two that
 * animate use CSS keyframes that the existing global reduced-motion block
 * already freezes.
 */
export function PublicBackgroundVisual({
  variant,
  className,
}: {
  variant: 'path' | 'library' | 'veil' | 'signal';
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {variant === 'path' ? <PathMotif /> : null}
      {variant === 'library' ? <LibraryMotif /> : null}
      {variant === 'veil' ? <VeilMotif /> : null}
      {variant === 'signal' ? <SignalMotif /> : null}
    </div>
  );
}

/**
 * /about — two forms joined by a shared path with nine milestone nodes,
 * green to gold. The programme's whole shape in one line.
 */
function PathMotif() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_75%_25%,rgb(var(--blak-green)/0.13),transparent_70%)]" />
      <svg
        viewBox="0 0 900 420"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full opacity-70"
      >
        <defs>
          <linearGradient id="pp-path" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(var(--blak-green))" stopOpacity="0.65" />
            <stop offset="55%" stopColor="rgb(var(--blak-green-soft))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(var(--blak-gold))" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* The shared path: mentor on the left, mentee on the right, nine nodes
            between them. Abstract forms, never faces. */}
        <path
          d="M120 300 C 260 300, 300 180, 450 180 S 660 120, 800 118"
          fill="none"
          stroke="url(#pp-path)"
          strokeWidth="1.5"
        />
        {Array.from({ length: 9 }).map((_, index) => {
          const t = index / 8;
          const x = 120 + t * 680;
          const y = 300 - Math.pow(t, 0.85) * 182;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={index === 8 ? 5 : 3}
              fill={index === 8 ? 'rgb(var(--blak-gold))' : 'rgb(var(--blak-green-soft))'}
              fillOpacity={index === 8 ? 0.9 : 0.5}
            />
          );
        })}

        {/* The two forms: a wider ring for experience, a tighter one for
            ambition. Geometry, not portraiture. */}
        <circle cx="120" cy="300" r="26" fill="none" stroke="rgb(var(--blak-gold))" strokeOpacity="0.35" />
        <circle cx="120" cy="300" r="9" fill="rgb(var(--blak-gold))" fillOpacity="0.55" />
        <circle cx="800" cy="118" r="20" fill="none" stroke="rgb(var(--blak-green))" strokeOpacity="0.45" />
        <circle cx="800" cy="118" r="7" fill="rgb(var(--blak-green-soft))" fillOpacity="0.7" />
      </svg>
    </>
  );
}

/**
 * /faq — a quiet grid of shelves. The Knowledge Library, drawn as the thing it
 * is named after rather than as a question mark.
 */
function LibraryMotif() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_80%_20%,rgb(var(--blak-green)/0.11),transparent_70%)]" />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(var(--blak-border) / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--blak-border) / 0.05) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 70% 80% at 70% 30%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 70% 30%, black, transparent 75%)',
        }}
      />
    </>
  );
}

/**
 * /confidentiality — fine translucent layers, one behind another, with the
 * connection passing through the innermost. No padlocks, no shields, no fake
 * certification badges.
 */
function VeilMotif() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_60%_at_78%_30%,rgb(var(--blak-forest-2)/0.9),transparent_70%)]" />
      <svg
        viewBox="0 0 900 420"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full opacity-80"
      >
        {/* Three nested enclosures. */}
        {[
          { x: 470, w: 380, h: 300, o: 0.06 },
          { x: 520, w: 280, h: 220, o: 0.09 },
          { x: 570, w: 180, h: 140, o: 0.14 },
        ].map((layer) => (
          <rect
            key={layer.w}
            x={layer.x}
            y={210 - layer.h / 2}
            width={layer.w}
            height={layer.h}
            rx="28"
            fill="rgb(var(--blak-green))"
            fillOpacity={layer.o * 0.35}
            stroke="rgb(var(--blak-green))"
            strokeOpacity={layer.o * 2.4}
          />
        ))}
        {/* The connection enters the innermost enclosure and stops there. */}
        <line
          x1="120"
          y1="210"
          x2="600"
          y2="210"
          stroke="rgb(var(--blak-green-soft))"
          strokeOpacity="0.35"
          strokeDasharray="4 8"
        />
        <circle cx="660" cy="210" r="6" fill="rgb(var(--blak-green-soft))" fillOpacity="0.8" />
        <circle cx="120" cy="210" r="6" fill="rgb(var(--blak-gold))" fillOpacity="0.7" />
      </svg>
    </>
  );
}

/**
 * /contact — a single signal reaching outward in soft concentric arcs. Someone
 * asking, and the arcs that carry it.
 */
function SignalMotif() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_65%_at_80%_35%,rgb(var(--blak-gold)/0.10),transparent_70%)]" />
      <svg
        viewBox="0 0 900 420"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full opacity-70"
      >
        {[40, 90, 140, 190, 240].map((r, index) => (
          <circle
            key={r}
            cx="740"
            cy="200"
            r={r}
            fill="none"
            stroke={index % 2 === 0 ? 'rgb(var(--blak-green))' : 'rgb(var(--blak-gold))'}
            strokeOpacity={0.3 - index * 0.045}
          />
        ))}
        <circle cx="740" cy="200" r="7" fill="rgb(var(--blak-green-soft))" fillOpacity="0.85" />
      </svg>
    </>
  );
}
