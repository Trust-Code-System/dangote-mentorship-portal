# BLAK MOH Landing Page — TODO

Markers: `[ ]` not started · `[~]` in progress · `[x]` completed · `[!]` blocked

---

## Phase 1 — Discovery

- [x] Audit repository stack, package manager, styling system
- [x] Locate public homepage route and public layout
- [x] Locate brand assets; confirm transparency of each
- [x] Sample exact logo green / gold from the PNG (`#14B21F`, `#119A19`, `#CD9933`)
- [x] Locate EN/FR message files and the locale mechanism (cookie, no path segment)
- [x] Locate auth, about, FAQ, signup, support routes; confirm which do **not** exist
- [x] Inventory verified vs. placeholder programme statistics
- [x] Confirm no Motion / GSAP / Lenis / Three.js / R3F / React Bits installed
- [x] Read CSP + robots constraints in `next.config.mjs` / `robots.ts`
- [x] Capture before screenshots (desktop 1440, mobile 390)
- [x] Write `LANDING_PAGE_MASTER_SPEC.md`, this file, `LANDING_PAGE_COMPONENT_MAP.md`

## Phase 2 — Static art direction

- [x] Install `three`, `@react-three/fiber`, `gsap`, `motion` (drei installed, then removed — see report)
- [x] Add `--blak-*` dark token layer (additive, portal untouched)
- [x] Expose `blak-*` colours + `font-serif` in `tailwind.config.ts`
- [x] Add Instrument Serif via `next/font/google`
- [x] Add `landing` namespace to `messages/en.json`
- [x] Add `landing` namespace to `messages/fr.json` (proper French typography)
- [x] New `(landing)` route group + dark layout; move `/` out of `(public)`
- [x] Floating navigation (desktop + mobile sheet)
- [x] Hero structure, typography, CTAs (static)
- [x] Human problem statement section
- [x] AI-assisted matching section (static composition)
- [x] Nine-month journey section (static, all nine stages)
- [x] Real mentorship tools section
- [x] Bilingual experience section
- [x] Privacy & human control section
- [x] Programme principles section (verified facts only)
- [x] Final transformation + CTA section
- [x] Landing footer
- [x] Verify EN and FR render correctly with no truncation

## Phase 3 — Motion foundation

- [x] `useReducedMotion` hook (useSyncExternalStore) + global motion gate
- [x] Split-text / blur hero reveal (fade when reduced)
- [x] Scroll-reveal for editorial statements
- [x] Navigation enter + scrolled-state transition + active-section indicator
- [x] Scroll progress indicator
- [x] Reduced-motion end-states for every animated element

## Phase 4 — 3D hero

- [x] `ContinuumCanvas` shell, dynamic `ssr:false`, no layout shift
- [x] Mentor form (satin ceramic, gold rim)
- [x] Mentee form (frosted translucent, green rim)
- [x] Knowledge core
- [x] Particle stream along a curve (custom shader)
- [x] Camera rig: scroll travel + damped pointer parallax
- [x] Adaptive quality (own `QualityGuard`, replacing drei) + `frameloop="demand"` + offscreen/hidden pause
- [x] WebGL-unavailable + context-lost fallback
- [x] Mobile / low-power path (canvas never mounts)

## Phase 5 — Scroll narrative

- [x] Hero → matching camera hand-off
- [x] Interactive matching network (EN/FR + 4 criteria, keyboard operable)
- [x] Human-approval beat ("Intelligent suggestions. Human decisions.")
- [x] Nine-stage journey, GSAP-pinned on desktop
- [x] Journey as vertical card stack on mobile
- [x] Final transformation scene

## Phase 6 — Supporting effects

- [x] Light-rays environmental layer (one only, low opacity)
- [x] Film grain overlay
- [x] Radial readability mask + edge vignette
- [x] Glass surface treatment for nav and panels
- [x] Confirm no more than three recognisable effects compete

## Phase 7 — Optimisation

- [x] Dynamic-import GSAP inside the journey effect
- [x] Draw-call / material budget check
- [x] Weak-device mode verified
- [x] Bundle impact measured (611 KiB desktop / 317 KiB mobile JS)
- [x] Core Web Vitals measured (desktop green; mobile LCP over budget — see report)

## Phase 8 — QA

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test`
- [x] Landing unit tests (EN/FR parity, journey stages)
- [x] Playwright landing e2e
- [x] Browser QA: nav, CTAs, `/login`, `/signup`, `/about`, `/faq`, anchors
- [x] Keyboard traversal + skip link + focus visibility
- [x] Reduced motion
- [x] WebGL disabled
- [x] 200 % zoom, 320 px width, no horizontal overflow
- [x] Console / hydration / network error check
- [x] Screenshots 1440×900, 1024×768, 390×844, 375×812 — EN + FR
- [x] Lighthouse desktop + mobile (median of 3 runs each, production build)
- [x] `LANDING_PAGE_IMPLEMENTATION_REPORT.md`

## Blocked / owner input required

- [!] Real mentor / mentee counts — placeholders removed from the page pending owner confirmation
- [!] Public Privacy Policy and Terms routes do not exist — footer links to `/faq#privacy`, Terms omitted
- [!] Support inbox address unconfirmed (`admin@blakmoh.com` inherited from `/signup`)
- [!] No transparent dark-surface logo lockup file supplied — using mark + HTML wordmark
