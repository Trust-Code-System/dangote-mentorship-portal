import type { Config } from 'tailwindcss';

// Theme extension for the Design System (§19 — docs/design-system.md). Colors
// reference the RGB-channel tokens in globals.css via `rgb(var(--x) / <alpha>)`
// so alpha modifiers work. Both the palette names (green, ink, surface, status)
// and the shadcn semantic aliases are exposed.
const withAlpha = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1280px' }, // content max-width ~1280 (§3)
    },
    extend: {
      colors: {
        // ── Palette tokens (§1) ──
        bg: withAlpha('--bg'),
        surface: { DEFAULT: withAlpha('--surface'), 2: withAlpha('--surface-2') },
        ink: { DEFAULT: withAlpha('--ink'), 2: withAlpha('--ink-2'), 3: withAlpha('--ink-3') },
        green: {
          DEFAULT: withAlpha('--green'),
          light: withAlpha('--green-light'),
          strong: withAlpha('--green-strong'),
          soft: withAlpha('--green-soft'),
        },
        gold: withAlpha('--gold'),
        ok: withAlpha('--ok'),
        warn: withAlpha('--warn'),
        risk: withAlpha('--risk'),
        info: withAlpha('--info'),

        // ── shadcn semantic aliases (themed onto the palette) ──
        border: withAlpha('--border'),
        input: withAlpha('--input'),
        ring: withAlpha('--ring'),
        background: withAlpha('--background'),
        foreground: withAlpha('--foreground'),
        primary: { DEFAULT: withAlpha('--primary'), foreground: withAlpha('--primary-foreground') },
        secondary: {
          DEFAULT: withAlpha('--secondary'),
          foreground: withAlpha('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: withAlpha('--destructive'),
          foreground: withAlpha('--destructive-foreground'),
        },
        muted: { DEFAULT: withAlpha('--muted'), foreground: withAlpha('--muted-foreground') },
        accent: { DEFAULT: withAlpha('--accent'), foreground: withAlpha('--accent-foreground') },
        popover: { DEFAULT: withAlpha('--popover'), foreground: withAlpha('--popover-foreground') },
        card: { DEFAULT: withAlpha('--card'), foreground: withAlpha('--card-foreground') },

        // ── BLAK MOH cinematic landing palette (additive; landing route only) ──
        // Greens and gold sampled pixel-exact from the supplied logo artwork.
        blak: {
          black: withAlpha('--blak-black'),
          forest: withAlpha('--blak-forest'),
          'forest-2': withAlpha('--blak-forest-2'),
          green: withAlpha('--blak-green'),
          'green-deep': withAlpha('--blak-green-deep'),
          'green-soft': withAlpha('--blak-green-soft'),
          gold: withAlpha('--blak-gold'),
          'gold-soft': withAlpha('--blak-gold-soft'),
          ivory: withAlpha('--blak-ivory'),
          text: withAlpha('--blak-text'),
          'text-2': withAlpha('--blak-text-2'),
          border: withAlpha('--blak-border'),
          glass: withAlpha('--blak-glass'),
        },

        // ── Warm ivory authentication surface (auth routes only) ──
        auth: {
          surface: withAlpha('--auth-surface'),
          field: withAlpha('--auth-field'),
          border: withAlpha('--auth-border'),
          ink: withAlpha('--auth-ink'),
          'ink-2': withAlpha('--auth-ink-2'),
        },
      },
      fontFamily: {
        // One grotesque for everything (Atlas-style): Inter for both headings
        // (heavy weights) and body/UI. Self-hosted via next/font (app/layout.tsx).
        display: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        // Editorial serif — the landing page's second (and last) family. Used
        // sparingly for emotional statements only, never for UI or body copy.
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        // Type scale (§2) — [size, lineHeight]. Headings run heavy (Atlas-style):
        // big titles extrabold, sub-heads bold.
        display: ['2.25rem', { lineHeight: '2.75rem', fontWeight: '800' }], // 36/44
        h1: ['1.75rem', { lineHeight: '2.25rem', fontWeight: '700' }], // 28/36
        h2: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '700' }], // 20/28
        h3: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }], // 16/24
        body: ['0.9375rem', { lineHeight: '1.5rem' }], // 15/24
        small: ['0.8125rem', { lineHeight: '1.25rem' }], // 13/20
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em', fontWeight: '600' }], // 11/16

        // ── Editorial display sizes, landing page only. Fluid via clamp so
        // 320px → 1920px needs no per-breakpoint overrides and 200% zoom holds.
        'blak-hero': [
          'clamp(2.5rem, 6.2vw, 5.25rem)',
          { lineHeight: '1.02', letterSpacing: '-0.03em' },
        ],
        'blak-statement': [
          'clamp(1.875rem, 4vw, 3.5rem)',
          { lineHeight: '1.12', letterSpacing: '-0.02em' },
        ],
        'blak-section': [
          'clamp(1.75rem, 3vw, 2.75rem)',
          { lineHeight: '1.15', letterSpacing: '-0.02em' },
        ],
        // Landing body copy never drops below 16px (spec §6).
        'blak-body': ['clamp(1rem, 1.1vw, 1.125rem)', { lineHeight: '1.65' }],
        'blak-label': [
          '0.75rem',
          { lineHeight: '1rem', letterSpacing: '0.14em', fontWeight: '600' },
        ],
      },
      borderRadius: {
        lg: 'var(--radius)', // 16px cards
        md: 'calc(var(--radius) - 6px)', // 10px controls
        sm: 'calc(var(--radius) - 8px)', // 8px
      },
      boxShadow: {
        // Soft layered elevation (§3) — gives white cards a gentle "float" over
        // the light canvas. `elevation-lg` is the raised/hover state; `glow` is
        // the colored green ambient shadow under primary buttons and the active
        // nav pill (the PulseHR-style depth).
        elevation: '0 1px 2px rgba(16,42,26,.04), 0 8px 24px -6px rgba(16,42,26,.08)',
        'elevation-lg': '0 2px 4px rgba(16,42,26,.05), 0 18px 40px -10px rgba(16,42,26,.13)',
        glow: '0 6px 16px -4px rgba(40,133,68,.45)',
      },
      keyframes: {
        'rail-fill': { from: { width: '0%' }, to: { width: 'var(--rail-fill, 0%)' } },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
