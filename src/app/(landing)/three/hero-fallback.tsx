'use client';

import { useTranslations } from 'next-intl';

/**
 * The hero composition without WebGL (LANDING_PAGE_MASTER_SPEC.md §11).
 *
 * This is what renders when: JavaScript hasn't run yet, WebGL is unavailable or
 * blocked, the device is small or low-powered, or the live context is lost. It
 * is **not** a placeholder — it is a designed still of the same scene: the
 * mentor form in gold, the mentee form in green, the knowledge core between
 * them, and light travelling the connection.
 *
 * Inline SVG + CSS only: zero bytes of asset, no network request, no canvas,
 * nothing to fail. Decorative, so the whole thing is hidden from assistive
 * technology — the hero's meaning lives in the DOM text beside it.
 */
export function HeroFallback() {
  const t = useTranslations('landing.hero');

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Ambient blooms: gold = experience (left), green = growth (right). */}
      <div className="landing-bloom absolute left-[14%] top-1/2 size-[26rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--blak-gold)/0.20),transparent_65%)] blur-2xl" />
      <div
        className="landing-bloom absolute right-[14%] top-1/2 size-[26rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--blak-green)/0.24),transparent_65%)] blur-2xl"
        style={{ animationDelay: '-4.5s' }}
      />

      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <title>{t('sceneDescription')}</title>
        <defs>
          <linearGradient id="blak-connection" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(var(--blak-gold))" stopOpacity="0.75" />
            <stop offset="50%" stopColor="rgb(var(--blak-green-soft))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(var(--blak-green))" stopOpacity="0.75" />
          </linearGradient>
          <radialGradient id="blak-core">
            <stop offset="0%" stopColor="rgb(var(--blak-ivory))" stopOpacity="0.95" />
            <stop offset="45%" stopColor="rgb(var(--blak-green-soft))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(var(--blak-green))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="blak-mentor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--blak-gold-soft))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(var(--blak-gold))" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="blak-mentee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--blak-green-soft))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(var(--blak-green))" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Ground line — a horizon, not a floor. */}
        <line
          x1="0"
          y1="520"
          x2="1200"
          y2="520"
          stroke="rgb(var(--blak-ivory))"
          strokeOpacity="0.07"
        />

        {/* Mentor — the taller, settled form. Stylised sculptural silhouette:
            a capsule head over a tapered torso, never a face. */}
        <g opacity="0.9">
          <ellipse cx="250" cy="300" rx="26" ry="30" fill="url(#blak-mentor)" />
          <path
            d="M250 336 C 300 350, 316 430, 306 520 L 194 520 C 184 430, 200 350, 250 336 Z"
            fill="url(#blak-mentor)"
          />
          <path
            d="M250 336 C 300 350, 316 430, 306 520"
            fill="none"
            stroke="rgb(var(--blak-gold))"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
        </g>

        {/* Mentee — slightly smaller, leaning toward the connection. */}
        <g opacity="0.9">
          <ellipse cx="950" cy="322" rx="23" ry="27" fill="url(#blak-mentee)" />
          <path
            d="M950 354 C 994 366, 1008 438, 999 520 L 901 520 C 892 438, 906 366, 950 354 Z"
            fill="url(#blak-mentee)"
          />
          <path
            d="M950 354 C 906 366, 892 438, 901 520"
            fill="none"
            stroke="rgb(var(--blak-green))"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
        </g>

        {/* The connection: a single arc from experience to ambition, through the
            shared goal at its centre. */}
        <path
          id="blak-arc"
          d="M282 316 Q 600 190, 918 338"
          fill="none"
          stroke="url(#blak-connection)"
          strokeWidth="1.5"
          strokeOpacity="0.65"
        />
        {/* Light travelling the connection. */}
        <path
          d="M282 316 Q 600 190, 918 338"
          fill="none"
          stroke="rgb(var(--blak-green-soft))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="18 222"
          className="landing-stream"
          opacity="0.95"
        />

        {/* Shared goal / knowledge core at the apex of the arc. */}
        <circle cx="600" cy="252" r="66" fill="url(#blak-core)" />
        <circle
          cx="600"
          cy="252"
          r="15"
          fill="none"
          stroke="rgb(var(--blak-ivory))"
          strokeOpacity="0.7"
        />
        <circle
          cx="600"
          cy="252"
          r="15"
          fill="none"
          stroke="rgb(var(--blak-green-soft))"
          strokeOpacity="0.5"
          className="landing-pulse-ring"
          style={{ transformOrigin: '600px 252px' }}
        />
        <circle cx="600" cy="252" r="4" fill="rgb(var(--blak-ivory))" />
      </svg>
    </div>
  );
}
