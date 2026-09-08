# BLAK MOH Landing Page — Component Map

Every component, package and effect that makes up the landing experience, and where it came from.
Scope is `src/app/(landing)/**` plus the shared token/font additions. Nothing in `(dashboard)`,
`(admin)` or `(auth)` is part of this map.

---

## 1. Packages added

| Package               | Version   | Why                                                   | Loading                                  |
| --------------------- | --------- | ----------------------------------------------------- | ---------------------------------------- |
| `three`               | ^0.185.1  | 3D primitives, curves, shader material                | dynamic, client-only, capable devices     |
| `@react-three/fiber`  | ^9.6.1    | React renderer for three (React 19 compatible)        | dynamic, client-only                      |
| `gsap`                | ^3.15.0   | ScrollTrigger — pinned nine-stage journey             | dynamic import inside the section effect  |
| `motion`              | ^12.42.2  | Cross-fades in the three interactive sections + nav   | client components only                    |

**Installed and then removed: `@react-three/drei`.** It was pulled in for exactly two components,
`AdaptiveDpr` and `PerformanceMonitor`, and cost **86 KiB transferred**. Both are replaced by
`three/quality-guard.tsx` (~40 lines). Removing it took the desktop Lighthouse performance score from
56 to 77 in a single change — by far the largest single win of the whole build.

**Not installed, deliberately:** `lenis` (smooth-scroll hijacking is the biggest a11y /
scroll-restoration risk in this brief and the design does not need it), `@react-three/postprocessing`
(bloom is faked with additive shells + a CSS radial glow, saving a large bundle and a full-screen pass).

`@types/three` was not needed — `three` ships its own type definitions.

### Where Motion is and is not used

Motion earns its place only where an element genuinely enters *and leaves*: the cross-fades in the
matching, tools and journey sections, plus the nav entrance and the scroll-progress spring.

The two most-used effects on the page — `ScrollReveal` (~40 instances) and `RevealText` — are **CSS
transitions toggled by an `IntersectionObserver`**, not Motion components. Hydrating forty JS
animators was a measurable share of mobile main-thread work, and a class toggle is visually identical.
The hero goes further and uses no JS at all (see `HeroRevealText`).

---

## 2. React Bits strategy — read this before auditing the effects

The React Bits documentation site is a client-rendered SPA and its component source is distributed by
copy-paste / the `jsrepo` CLI rather than as a versioned npm dependency, under a licence
(MIT + Commons Clause) whose redistribution terms are not worth inheriting into a client-owned
corporate codebase for a handful of visual effects.

**Decision: no React Bits source is vendored into this repository.** The three supporting effects below
are original implementations written against the BLAK MOH token system. They are listed here with the
React Bits pattern they are equivalent to, so the inventory is honest about the lineage — the brief's
"React Bits should provide implementation ingredients, not the art direction" is satisfied by taking the
*idea* and none of the code or default styling.

| BLAK MOH component      | Equivalent React Bits pattern | Origin                                             |
| ----------------------- | ----------------------------- | -------------------------------------------------- |
| `LightField`            | Light Rays / Threads          | Original — CSS conic + radial gradients, no canvas  |
| `RevealText`            | Split Text / Blur Text        | Original — Motion, per-word mask + blur             |
| `ScrollReveal`          | Scroll Reveal                 | Original — `IntersectionObserver` + Motion          |
| `GlassPanel`            | Glass Surface                 | Original — token-based backdrop-blur surface        |

Exactly **three** recognisable environmental/text effects appear on the page (`LightField`, `RevealText`,
`ScrollReveal`); `GlassPanel` is a surface style, not an effect. No two animated backgrounds share a
viewport. No React Bits Pro code is used anywhere.

---

## 3. Route structure

| Path                                     | Purpose                                                        |
| ---------------------------------------- | -------------------------------------------------------------- |
| `src/app/(landing)/layout.tsx`           | Dark landing shell — skip link, `main`, nav, footer, grain      |
| `src/app/(landing)/page.tsx`             | Server component: auth redirect + section composition           |
| `src/app/(landing)/opengraph-image.tsx`  | Runtime OG image from the hero composition (`next/og`)          |
| `src/app/(public)/layout.tsx`            | **unchanged** — still wraps `/about`, `/faq`, `/design`         |

`/` moved out of `(public)` into `(landing)` so the marketing home can own a dark chrome without
altering the light chrome of the other public pages or the portal.

---

## 4. Components

### 4.1 Chrome

| Component            | File                                          | Client? | Notes                                                                 |
| -------------------- | --------------------------------------------- | ------- | --------------------------------------------------------------------- |
| `LandingNav`         | `components/landing-nav.tsx`                  | yes     | Floating glass bar, max-w 1280, scroll-state opacity, active-section indicator, mobile sheet |
| `LandingFooter`      | `components/landing-footer.tsx`               | no      | Lockup, statement, real routes only, locale control, copyright         |
| `LandingLocaleToggle`| `components/landing-locale-toggle.tsx`        | yes     | Dark restyle of the existing `setLocale` action; `aria-pressed` pair   |
| `ScrollProgress`     | `components/scroll-progress.tsx`              | yes     | 2 px green/gold progress rail, `aria-hidden`                           |

### 4.2 Sections

Five of the nine are **server components** — they hold no state and only compose copy, so there is no
reason to ship or hydrate them. Only the genuinely interactive three (plus the hero, which probes
device capability) are client components.

| Component               | File                                  | Kind   | Beat                                     |
| ----------------------- | ------------------------------------- | ------ | ---------------------------------------- |
| `LandingHero`           | `sections/landing-hero.tsx`           | client | Two lights find each other                |
| `SectionProblem`        | `sections/section-problem.tsx`        | server | Why it matters — editorial, no cards      |
| `SectionMatching`       | `sections/section-matching.tsx`       | client | Intelligent suggestions, human decisions  |
| `SectionJourney`        | `sections/section-journey.tsx`        | client | Nine stages, pinned on desktop            |
| `SectionTools`          | `sections/section-tools.tsx`          | client | Real workflows as layered glass panels    |
| `SectionBilingual`      | `sections/section-bilingual.tsx`      | server | Path splits EN/FR, rejoins                |
| `SectionPrivacy`        | `sections/section-privacy.tsx`        | server | Three principles, no padlock cliché       |
| `SectionPrinciples`     | `sections/section-principles.tsx`     | server | Verified structural facts only            |
| `SectionTransformation` | `sections/section-transformation.tsx` | server | Mentee steps forward + final CTA          |

### 4.3 3D

| Component          | File                                     | Notes                                                      |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| `ContinuumCanvas`  | `three/continuum-canvas.tsx`             | `next/dynamic({ ssr:false })`, frame policy, context-loss handling |
| `ContinuumScene`   | `three/continuum-scene.tsx`              | Scene graph, fog, lights, quality tiers                     |
| `QualityGuard`     | `three/quality-guard.tsx`                | FPS sampling → DPR + particle-budget step-down (replaces drei) |
| `MentorForm`       | `three/forms.tsx`                        | Satin ceramic sculptural form, gold rim light               |
| `MenteeForm`       | `three/forms.tsx`                        | Frosted translucent form, green rim light                   |
| `KnowledgeCore`    | `three/knowledge-core.tsx`               | Icosahedron + additive shell                                |
| `ContinuumStream`  | `three/continuum-stream.tsx`             | Catmull-Rom curve + custom `ShaderMaterial` points          |
| `CameraRig`        | `three/camera-rig.tsx`                   | Damped scroll travel + pointer parallax (±0.4 units)        |
| `HeroFallback`     | `three/hero-fallback.tsx`                | CSS + inline SVG still composition — no WebGL, no files     |

### 4.4 Primitives

| Component      | File                                  | Notes                                                           |
| -------------- | ------------------------------------- | --------------------------------------------------------------- |
| `HeroRevealText` | `motion/hero-reveal-text.tsx`       | Hero headline. **Zero JS** — server-rendered + CSS animation, so the LCP never waits on hydration |
| `RevealText`   | `motion/reveal-text.tsx`              | Section headings. Per-word mask + blur, CSS-driven, IO-triggered |
| `ScrollReveal` | `motion/scroll-reveal.tsx`            | Viewport-triggered entrance; CSS transition + shared IO hook     |
| `useInView`    | `hooks/use-in-view.ts`                | One-shot IntersectionObserver behind both reveals                |
| `LightField`   | `visuals/light-field.tsx`             | The single environmental background layer                        |
| `FilmGrain`    | `visuals/film-grain.tsx`              | Inline SVG turbulence, ~4 % opacity, `aria-hidden`               |
| `GlassPanel`   | `visuals/glass-panel.tsx`             | Dark glass surface — nav, tool panels, matching cards            |
| `Counter`      | `motion/counter.tsx`                  | Tabular-num count-up, once, final value always in the DOM        |
| `useReducedMotion` | `hooks/use-reduced-motion.ts`     | Single source of truth for the motion gate                       |
| `useCanRender3D`   | `hooks/use-can-render-3d.ts`      | WebGL support + viewport + memory/core heuristics                |

---

## 5. Shared files touched outside the landing route

| File                       | Change                                                                    | Portal impact |
| -------------------------- | ------------------------------------------------------------------------- | ------------- |
| `src/app/layout.tsx`       | Adds Instrument Serif as `--font-serif` alongside Public Sans              | none — no portal rule uses `font-serif` |
| `src/app/globals.css`      | Adds an **additive** `--blak-*` token block + landing-only utilities       | none — no existing token value changed |
| `tailwind.config.ts`       | Adds `blak-*` colours, `font-serif`, landing keyframes                     | none — additive only |
| `messages/en.json` / `fr.json` | Adds the `landing` namespace                                           | none — new namespace |
| `next.config.mjs`          | No change required (scene is procedural; CSP already allows it)            | none |

`SiteHeader`, `SiteFooter`, `BrandLogo`, `Wordmark`, `LocaleSwitcher` and every UI primitive are
**read-only** to this work — the landing page composes its own dark chrome rather than adding dark
variants to shared portal components.

---

## 6. Asset inventory

| Asset                                | Bytes added | Source                       |
| ------------------------------------ | ----------- | ---------------------------- |
| `public/brand/blak-moh-mark.png`     | 0 (existing)| official supplied mark        |
| Instrument Serif (400 + italic)      | ~2 × 20 KB  | `next/font/google`, self-hosted at build |
| 3D geometry / particles / stream     | **0**       | procedural in code            |
| Hero fallback                        | **0**       | CSS + inline SVG              |
| OG image                             | 0 (runtime) | `next/og`                     |

No stock photography, no third-party video, no CDN asset, no placeholder logo of any kind.
