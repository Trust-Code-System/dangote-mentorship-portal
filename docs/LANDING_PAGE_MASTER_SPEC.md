# BLAK MOH — Landing Page Master Specification

**Concept:** The Mentorship Continuum — _"Experience becomes direction. Ambition becomes leadership."_

**Scope:** the public marketing route `/` only. The authenticated portal (`(dashboard)`, `(admin)`, `(auth)`) is
untouched. Status markers live in `LANDING_PAGE_TODO.md`; the component inventory lives in
`LANDING_PAGE_COMPONENT_MAP.md`.

---

## 1. Current-state findings (Phase 1 discovery)

Everything below was read out of the repository, not assumed.

### 1.1 Stack

| Concern         | Actual                                                                              |
| --------------- | ----------------------------------------------------------------------------------- |
| Framework       | Next.js **16.2.9**, App Router, React **19**, TypeScript strict                       |
| Package manager | **npm** (`package-lock.json`, no pnpm/yarn lockfile)                                  |
| Styling         | **Tailwind CSS 3.4.17** + shadcn/ui (`components.json`), CSS-variable design tokens   |
| i18n            | **next-intl 4.13**, cookie-driven (`NEXT_LOCALE`), **no locale path segments**        |
| Fonts           | **Public Sans** self-hosted via `next/font/google`, exposed as `--font-inter`         |
| Auth            | Auth.js (next-auth 5 beta) — `/login`, invite-only `/signup`                          |
| Testing         | Vitest + Testing Library, Playwright (`tests/e2e`), `scripts/shot.mjs` screenshotter  |
| Error reporting | Sentry (`@sentry/nextjs`), env-gated                                                  |

**Motion / 3D libraries already installed: none.** No Motion, no GSAP, no Lenis, no Three.js, no React
Three Fiber, no React Bits. All landing-page animation in the repo today is hand-written CSS keyframes in
`src/app/globals.css`.

### 1.2 Routes (verified)

- Public: `/` (`src/app/(public)/page.tsx`), `/about`, `/faq`, `/design` (internal token preview).
- Auth: `/login`, `/signup` (invite-code redemption + "request access" mailto — **there is no self-service
  sign-up**), `/forgot-password`, `/invite/[token]`, `/reset-password/[token]`.
- The public layout `src/app/(public)/layout.tsx` wraps every public page in `SiteHeader` + `SiteFooter`.
- **There is no `/privacy`, `/terms` or `/support` public route.** The authenticated app has `/support`
  (auth-gated) and `/help`. This constrains the footer — see §11.

### 1.3 Brand assets

- `public/brand/blak-moh-original.png` — 1600×914 full lockup. **Background is opaque `#F7F7F7`, not
  transparent**, and "BLAK" is solid black. It therefore cannot be placed directly on a dark surface.
- `public/brand/blak-moh-mark.png` — the "B/m" mark, **transparent**, reads on dark. This is what the dark
  landing page uses, paired with the existing HTML `<Wordmark>` (recoloured for dark, not redrawn).
- The lockup is not recreated, reinterpreted or replaced — the landing page reuses the project's existing
  `BrandMark` + `Wordmark` lockup components, which is the same lockup the portal already ships.

### 1.4 Colours sampled from the logo file (not guessed)

Dominant opaque pixels of `blak-moh-original.png`, sampled with `System.Drawing`:

| Hex       | Pixels  | Role in the logo             |
| --------- | ------- | ---------------------------- |
| `#F7F7F7` | 76 763  | logo plate / off-white        |
| `#14B21F` | 26 497  | **primary logo green**        |
| `#119A19` | 25 446  | deep green of the script "m"  |
| `#000000` | 4 744   | "BLAK" wordmark               |
| `#CD9933` | (dot)   | **gold full stop after MOH**  |

`#14B21F` and `#CD9933` are used verbatim as `--blak-green` and `--blak-gold`.

### 1.5 Content facts that are verified vs. unverified

**Verified in the repo — safe to state on the page:**

- Nine journey stages, in order: Profile → Training → Matched → Agreement → Goals → Sessions →
  Mid-term review → Final review → Certificate (`messages/en.json` → `home.journey.nodes`, and the
  authenticated journey rail).
- Nine-month programme duration, two interface languages EN/FR (`src/i18n/config.ts`), six roles
  (CLAUDE.md §4 RBAC matrix, enforced in `src/lib/auth`).
- Matching is language-hard-ruled and admin-approved: `src/features/matching/engine.ts` —
  `LANGUAGE_MISMATCH` is a hard-rule failure that is explicitly **not** configurable.
- Matching weights: competency 30 · career goal 25 · experience 20 · department 10 · availability 10 ·
  personality 5 (`DEFAULT_WEIGHTS`).
- Real participant features that exist as routes: goals, meetings, sessions, messages, journal,
  agreements, calendar, mid-term/final review, certificate, support, help.
- Confidentiality model: direct messages are private to participants; admins see metadata only
  (CLAUDE.md §7/§10, enforced server-side).

**Unverified — deliberately NOT presented as fact (see §12 owner decisions):**

- "120+ mentors" and "300+ mentees" (`home.stats.*Value`). These trace to CLAUDE.md's _planned_ cohort
  size ("~120 mentors / ~300 mentees"), not to live data. Per the brief they are removed from the new page
  and flagged for owner verification. The Programme section ships **principles + structural facts** instead.

### 1.6 Security / SEO constraints discovered

- `next.config.mjs` sets a CSP with `script-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`,
  `font-src 'self'`, `worker-src` unset (falls back to `default-src 'self'`).
  → **The 3D scene must be fully bundled and procedural.** No CDN Draco/KTX2 decoders, no external
  model hosts, no blob workers. Satisfied: the scene is generated in code, zero binary assets.
- Site-wide `X-Robots-Tag: noindex, nofollow` plus `src/app/robots.ts` disallow-all. This is intentional —
  it is a confidential internal portal. **It is preserved.** SEO work is limited to correct title,
  description, canonical, and Open Graph metadata for link unfurls inside the organisation.

### 1.7 Performance baseline (before)

Screenshots: `docs/landing-evidence/before/home-desktop-1440.png`, `.../home-mobile-390.png`.
Baseline page is a static server-rendered light page: no client JS beyond the locale switcher, no canvas.
Any regression budget is therefore measured against a very cheap starting point — see §9.

---

## 2. Final page architecture

New route group `src/app/(landing)/` owning `/` with its own dark layout. `about`/`faq`/`design` stay in
`(public)` with the existing light `SiteHeader`/`SiteFooter`, so **the portal and inner public pages are
visually unchanged**.

| #   | Section                | Component                    | Narrative beat                                   |
| --- | ---------------------- | ---------------------------- | ------------------------------------------------ |
| 1   | Floating navigation    | `landing-nav.tsx`            | —                                                |
| 2   | Cinematic hero         | `landing-hero.tsx` + R3F     | Two points of light find each other              |
| 3   | Human problem          | `section-problem.tsx`        | Why the connection matters                       |
| 4   | AI-assisted matching   | `section-matching.tsx`       | How the connection is proposed — and approved    |
| 5   | Nine-month journey     | `section-journey.tsx`        | The connection becomes a path                    |
| 6   | Real mentorship tools  | `section-tools.tsx`          | What you actually do along the path              |
| 7   | Bilingual experience   | `section-bilingual.tsx`      | The path splits by language and rejoins          |
| 8   | Privacy & human control| `section-privacy.tsx`        | The path is protected                            |
| 9   | Programme principles   | `section-principles.tsx`     | What the path guarantees (verified facts only)   |
| 10  | Final transformation   | `section-transformation.tsx` | The mentee steps forward alone                   |
| 11  | Final CTA              | (inside §10)                 | Enter / request access / learn                   |
| 12  | Footer                 | `landing-footer.tsx`         | —                                                |

Anchor ids: `#programme` (§3), `#matching` (§4), `#journey` (§5), `#experience` (§6), `#faq` → `/faq`.

---

## 3. Visual identity

Dark tokens are additive on `:root` in `globals.css` (prefix `--blak-*`), surfaced to Tailwind as
`blak-*` colours. **No existing token value changes**, so the portal cascade is untouched.

```
--blak-black        #000000   page foundation
--blak-forest       #061A0E   deep green-black, section beds
--blak-forest-2     #0B2416   raised bed
--blak-green        #14B21F   EXACT logo green — growth, active connection, primary CTA
--blak-green-deep   #119A19   logo secondary green
--blak-green-soft   #7ADE84   muted green highlight, small type on black
--blak-gold         #CD9933   EXACT logo gold — wisdom, mentor, milestones, completion
--blak-gold-soft    #E2BD7A
--blak-ivory        #F4F1EA   warm off-white
--blak-text         #F7F7F7   near-white primary text
--blak-text-2       #B2BAB3   softened ivory-grey secondary text
--blak-border       244 241 234 (used at 8–18% alpha)
--blak-glass        8 20 13   (used at 55–75% alpha)
```

Contrast (computed, on `#000`): `#F7F7F7` 20.1:1 · `#B2BAB3` 9.6:1 · `#14B21F` 7.4:1 · `#CD9933` 8.2:1.
Primary CTA is logo green `#14B21F` with near-black ink → **7.4:1**.

Semantics: **green = growth / progress / active connection / matching**; **gold = experience / wisdom /
milestones / completion**. No purple, no cyan, no "AI blue". Gradients are limited to forest→black,
green→gold, and transparent-green light through black. Materials: frosted glass (interface surfaces only),
dark brushed metal, satin ceramic (the 3D figures), fine film grain, controlled volumetric light.

**Typography — exactly two families:**

- Display: **Instrument Serif** (`next/font/google`, 400 + italic) → `--font-serif`, Tailwind `font-serif`.
  Used only for the second line of the hero, section statements and pull quotes.
- Interface: **Public Sans**, the established product font, unchanged.

All type stays live HTML text — nothing is baked into canvas, image or video.

---

## 4. Animation system

> **As built.** The plan below survived contact with measurement in outline but not in detail: `drei`
> was removed, and the two most-used effects moved from Motion to CSS. Both changes were driven by
> Lighthouse numbers, not preference — see LANDING_PAGE_IMPLEMENTATION_REPORT.md.

| Layer                                     | Owner                      | Why                                        |
| ----------------------------------------- | -------------------------- | ------------------------------------------ |
| 3D scene, camera, particles               | React Three Fiber          | The one custom cinematic surface           |
| Adaptive 3D quality                       | own `QualityGuard`         | drei cost 86 KiB for two components        |
| Pinned scroll narrative (nine-stage journey) | **GSAP ScrollTrigger**  | Deterministic scrubbing and pinning        |
| Cross-fades in the 3 interactive sections | **Motion** (`motion/react`)| Genuine enter *and* exit                   |
| Hero entrance                             | **CSS only, no JS**        | The LCP must not wait on hydration         |
| Scroll reveals (~40 instances)            | CSS + one IntersectionObserver | 40 JS animators was measurable main-thread cost |
| Simple state changes                      | CSS transitions            | Free                                       |

No element is ever driven by GSAP and Motion at the same time. **Lenis is deliberately not installed** —
native scrolling is used, because smooth-scroll hijacking is the single biggest accessibility and
back/forward-restoration risk in this brief and the design does not require it.

Motion language: weighted, calm, precise. Masked text reveals, opacity/transform only, slow parallax,
light travelling a path, object assembly. No constant floating, no elastic overshoot, no cursor trails,
no scroll-velocity tricks, no intro that blocks content.

---

## 5. 3D scene architecture

One `<Canvas>` on the page, fixed behind the hero and the following two sections, unmounted afterwards.

```
ContinuumCanvas            client-only, dynamic import, ssr:false, idle-deferred
└── Suspense
    ├── QualityGuard                       quality tier: high | medium
    ├── Fog + gradient environment          depth, no HDR file
    ├── MentorForm                          satin-ceramic capsule/torso, gold rim light
    ├── MenteeForm                          frosted translucent, green rim light
    ├── KnowledgeCore                       icosahedron, additive shell
    ├── ContinuumStream                     custom BufferGeometry curve + shader points
    └── CameraRig                           scroll- and pointer-driven (damped, ±0.4 units max)
```

Everything is procedural: `three` primitives + a small custom `ShaderMaterial` for the stream. **Zero
model, texture or HDR files** → nothing to compress, nothing to fetch, CSP-clean, ~0 asset bytes.

Budget: ≤ 12 draw calls, ≤ 6 materials, ≤ 2 500 particles at high tier (900 medium, 0 low), no real-time
shadows, no post-processing chain (bloom is faked with additive shells and a CSS radial glow).

Render policy:

- `frameloop="demand"` while idle; on-demand invalidation from scroll/pointer, plus a throttled RAF only
  while the stream is animating and the section is on screen.
- `IntersectionObserver` pauses the loop when the canvas leaves the viewport.
- `visibilitychange` pauses on hidden tab.
- DPR clamped to `[1, 1.75]`, `PerformanceMonitor` steps quality down on sustained low FPS.
- Mobile (< 768 px) and `deviceMemory < 4` / `hardwareConcurrency <= 4` → the canvas never mounts; the
  CSS/SVG fallback is used instead.

---

## 6. Responsive behaviour

Tuned at 320 / 375 / 390 / 768 / 1024 / 1280 / 1440 / 1920.

- **Desktop ≥ 1024:** full 3D hero, pointer parallax, GSAP-pinned nine-stage journey, layered glass panels.
- **Tablet 768–1023:** 3D hero at medium tier (fewer particles, smaller camera travel), journey unpinned
  into a two-column scroll, touch-sized controls (≥ 44 px).
- **Mobile < 768:** no WebGL. Pre-rendered CSS/SVG hero composition, single-column, stacked CTAs, vertical
  journey as a progress-lined card stack, no hover-only information, no body text under 16 px, safe-area
  padding (`env(safe-area-inset-*)`), `min-h-[100svh]` not `100vh`.

Never a scaled-down desktop layout: mobile gets shorter copy variants and different section components
where the desktop one would not read.

---

## 7. English / French behaviour

- All landing copy lives in the new `landing` namespace of `messages/en.json` and `messages/fr.json`.
  Zero hard-coded strings.
- The switcher is the existing `setLocale` server action (cookie + `revalidate`), restyled for dark. It
  does not touch auth state.
- Labels **inside** the matching visualisation and journey stages are translated too, including the
  simulated node labels.
- French is typeset properly: narrow no-break spaces before `?` `!` `:` `»`, `«` `»` quotes, and layouts
  sized for ~20 % longer strings (no truncation, `text-balance`/`text-pretty`, no fixed-width labels).
- Switching language re-renders the server components in place; scroll position is preserved because the
  action is a `useTransition` cookie write, not a navigation.

---

## 8. Accessibility strategy (WCAG 2.2 AA)

- Landmarks: `header` (nav) / `main` / `footer`, skip-to-content link as the first focusable element.
- Exactly one `h1` (the hero), then a strict `h2` per section, `h3` inside.
- Every canvas is `aria-hidden` + `pointer-events-none` where decorative; the hero canvas carries no
  information that is not also in the DOM.
- The matching demo and journey are keyboard-operable: real `<button>` tabs with roving `aria-selected`,
  arrow-key support, visible `:focus-visible` ring in `--blak-green` at ≥ 3:1 against its backdrop.
- Nothing is conveyed by colour alone — the language rejection in the matching demo also shows a strike
  state and text ("EN ✕ FR — different language").
- No hover-only information anywhere; every hover reveal has a focus and touch equivalent.
- 200 % zoom and 320 px width produce no horizontal scroll.
- `prefers-reduced-motion: reduce` → camera travel off, particle travel off, parallax off, split-text
  becomes a plain fade, counters render final values immediately, ScrollTrigger scrubs replaced by static
  end-states, journey shows all nine stages expanded. **No content or function is lost.**

---

## 9. Performance strategy

Targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, mobile Lighthouse performance ≥ 85, a11y / best-practices /
SEO ≥ 95.

- The hero headline, sub-copy and both CTAs are **server-rendered HTML** and are the LCP candidate. They
  never wait on the 3D bundle.
- `three`/`@react-three/fiber`/`@react-three/drei` are behind `next/dynamic({ ssr: false })` and only
  requested after the page is interactive, on capable devices.
- GSAP + ScrollTrigger are dynamically imported inside the journey section's effect.
- Canvas is absolutely positioned with a fixed aspect container → **no layout shift** when it mounts.
- Fonts: `display: 'swap'`, both families preloaded by `next/font`, self-hosted → no FOUT layout jump.
- No video, no image beyond the two existing brand PNGs; the hero fallback is CSS/SVG.
- The idle canvas does not render frames (see §5), so the page is not permanently at 60 fps.

---

## 10. Asset inventory

| Asset                                | Status                                              |
| ------------------------------------ | --------------------------------------------------- |
| `public/brand/blak-moh-mark.png`     | existing, reused as-is (transparent, dark-safe)      |
| `public/brand/blak-moh-original.png` | existing, **not** used on dark (opaque plate)        |
| Instrument Serif                     | new, self-hosted via `next/font/google` at build     |
| 3D geometry, particles, stream       | **procedural — no files**                            |
| Hero fallback                        | **CSS + inline SVG — no files**                      |
| Open Graph image                     | generated at runtime by `next/og` (`opengraph-image`)|

No stock imagery, no LOGOIPSUM, no third-party video, no external CDN asset of any kind.

---

## 11. Fallback strategy

| Condition                   | Behaviour                                                                     |
| --------------------------- | ----------------------------------------------------------------------------- |
| JS disabled / not yet loaded| Full page renders: nav, headline, sub-copy, CTAs, all sections, footer, static CSS hero composition. |
| WebGL unavailable / blocked | `ContinuumCanvas` catches the context failure and renders `HeroFallback` (CSS radial light field + inline SVG figures + stream). No blank area, no broken canvas. |
| Low-power / mobile          | Canvas never mounts; same `HeroFallback`.                                      |
| Reduced motion              | Canvas mounts but is frozen on a composed still frame; all scroll animation replaced by end-states. |
| WebGL context lost at runtime | `webglcontextlost` listener swaps in the fallback.                           |

Footer links: `/about` and `/faq` are real routes. **Privacy, Terms and Support have no public route**, so
the footer links Privacy → `/faq#privacy` (the confidentiality answer), Support → the same `mailto:`
address `/signup` already uses, and **omits Terms** rather than linking a 404. Flagged in §12.

---

## 12. Owner decisions still required

1. **Mentor / mentee counts.** `120+` / `300+` are planning figures, not live data. They are off the page
   until the owner confirms real numbers (or approves them as targets, worded as such).
2. **Public Privacy Policy / Terms pages.** Neither exists. Confirm whether to author them or keep the
   footer linking to the FAQ confidentiality answer.
3. **Support address.** The landing footer reuses `admin@blakmoh.com` from `/signup`. Confirm the real
   inbox before pilot.
4. **Dark logo lockup.** The landing page uses the transparent mark + HTML wordmark. If a proper
   transparent dark-surface lockup PNG/SVG exists, supply it and it will be dropped in.
5. **Indexing.** The site stays `noindex` (correct for a confidential portal). Confirm this is still
   intended if the landing page is ever meant to be publicly discoverable.

---

## 13. Test plan

**Automated**

- `npm run typecheck`, `npm run lint`, `npm test` must stay green.
- Vitest: `tests/landing/` — copy parity between `en.json` and `fr.json` for the whole `landing`
  namespace (every key present, no empty strings), and the journey-stage list matching the nine verified
  stages.
- Playwright `tests/e2e/landing.spec.ts` — happy path: load `/`, assert one `h1`, both CTAs route to
  `/login` and `#journey`, language switch flips to French and preserves scroll, skip link focuses main,
  no console errors, no horizontal overflow at 320 px.

**Manual, in the real browser**

Nav links · both hero CTAs · `/login` · `/signup` · `/about` · `/faq` · anchor navigation · mobile menu ·
full keyboard traversal · reduced motion · WebGL disabled · 200 % zoom · tablet orientation · browser
back/forward · refresh mid-page · console + network errors · hydration warnings · horizontal overflow ·
layout shift.

**Evidence** — `docs/landing-evidence/`: before/after screenshots at 1440×900, 1024×768, 390×844,
375×812, EN and FR, plus reduced-motion and WebGL-off states, and the Lighthouse reports.
