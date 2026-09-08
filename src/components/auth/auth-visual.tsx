import { cn } from '@/lib/utils';

/**
 * The brand panel's visual — a simplified version of the landing page's
 * mentorship connection (AUTH_UI_SPEC.md §2).
 *
 * **CSS and inline SVG only.** The landing page's React Three Fiber scene is
 * deliberately not loaded here: a sign-in screen is the worst possible place to
 * spend main-thread time, and the brief is explicit that auth must be lighter
 * than the landing page. Zero packages, zero WebGL, zero asset files, and the
 * form is never waiting on any of it.
 *
 * The composition reads left to right: the mentor form, a stream of light
 * carrying knowledge, and the mentee ahead of it — with a distant illuminated
 * goal on the horizon. Entirely decorative, so it is hidden from assistive
 * technology; every idea it expresses is also stated in the panel's text.
 *
 * Animation lives in `.landing-*` classes in globals.css and is frozen under
 * `prefers-reduced-motion`.
 */
export function AuthVisual({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* Ambient light: gold on the mentor's side, green on the mentee's. */}
      <div className="landing-bloom absolute -left-24 top-1/3 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(var(--blak-gold)/0.16),transparent_65%)] blur-3xl" />
      <div
        className="landing-bloom absolute -right-16 bottom-1/4 size-[32rem] rounded-full bg-[radial-gradient(circle,rgb(var(--blak-green)/0.22),transparent_65%)] blur-3xl"
        style={{ animationDelay: '-4.5s' }}
      />

      {/* A very faint pathway grid — structure without a literal room. */}
      <div className="bg-grid absolute inset-0 opacity-[0.45]" />

      {/* The composition sits to the RIGHT of the panel; the editorial copy runs
          down the left. `xMidYMax` anchors the horizon to the bottom edge so the
          figures stand on it at every panel height instead of being sliced. */}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 900 1000"
        preserveAspectRatio="xMidYMax slice"
        role="presentation"
      >
        <defs>
          <linearGradient id="auth-stream" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--blak-gold))" stopOpacity="0.75" />
            <stop offset="50%" stopColor="rgb(var(--blak-ivory))" stopOpacity="0.85" />
            <stop offset="100%" stopColor="rgb(var(--blak-green))" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="auth-mentor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--blak-gold-soft))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(var(--blak-gold))" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="auth-mentee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--blak-green-soft))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="rgb(var(--blak-green))" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id="auth-goal">
            <stop offset="0%" stopColor="rgb(var(--blak-ivory))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(var(--blak-green-soft))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The horizon, and the goal above it. */}
        <line x1="0" y1="860" x2="900" y2="860" stroke="rgb(var(--blak-ivory))" strokeOpacity="0.07" />
        <circle cx="760" cy="300" r="110" fill="url(#auth-goal)" />
        <circle cx="760" cy="300" r="5" fill="rgb(var(--blak-ivory))" fillOpacity="0.85" />
        <circle
          cx="760"
          cy="300"
          r="18"
          fill="none"
          stroke="rgb(var(--blak-green-soft))"
          strokeOpacity="0.4"
          className="landing-pulse-ring"
          style={{ transformOrigin: '760px 300px' }}
        />

        {/* Mentor — the settled form, standing on the horizon. */}
        <g opacity="0.85">
          <ellipse cx="565" cy="672" rx="30" ry="34" fill="url(#auth-mentor)" />
          <path
            d="M565 712 C 622 726, 640 796, 631 860 L 499 860 C 490 796, 508 726, 565 712 Z"
            fill="url(#auth-mentor)"
          />
        </g>

        {/* Mentee — ahead, and further along the path. */}
        <g opacity="0.9">
          <ellipse cx="748" cy="632" rx="27" ry="31" fill="url(#auth-mentee)" />
          <path
            d="M748 668 C 800 681, 816 790, 808 860 L 688 860 C 680 790, 696 681, 748 668 Z"
            fill="url(#auth-mentee)"
          />
        </g>

        {/* The connection: mentor → mentee. */}
        <path
          d="M597 664 C 650 606, 690 622, 722 626"
          fill="none"
          stroke="url(#auth-stream)"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
        <path
          d="M597 664 C 650 606, 690 622, 722 626"
          fill="none"
          stroke="rgb(var(--blak-ivory))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="12 228"
          className="landing-stream"
          opacity="0.9"
        />
        {/* …and on toward the goal. */}
        <path
          d="M772 604 C 790 520, 780 400, 764 322"
          fill="none"
          stroke="rgb(var(--blak-green-soft))"
          strokeWidth="1.25"
          strokeOpacity="0.35"
          strokeDasharray="4 9"
        />
      </svg>

      {/* Vignette, then a left-weighted scrim. The scrim is what guarantees the
          editorial copy keeps its contrast: the visual lives on the right, and
          the left third stays dark enough for text no matter how bright the
          light field behind it becomes. */}
      <div className="landing-vignette absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgb(var(--blak-black)/0.85)_0%,rgb(var(--blak-black)/0.6)_38%,rgb(var(--blak-black)/0.15)_68%,transparent_100%)]" />
    </div>
  );
}
