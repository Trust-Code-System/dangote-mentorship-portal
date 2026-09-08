# PUBLIC PAGES — TODO

`[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

## 0. Discovery
- [x] Inspect repository, route groups, auth allow-list
- [x] Identify every footer link (landing, auth, legacy public)
- [x] Identify 404 / placeholder destinations
- [x] Read EN + FR message files
- [x] Locate brand assets (`public/brand/blak-moh-mark.png`, `blak-moh-original.png`)
- [x] Verify the access model is invitation-only
- [x] Verify confidentiality behaviour in code before writing any claim
- [x] Confirm animation dependencies (motion, gsap, R3F present; React Bits absent)
- [x] `PUBLIC_PAGES_ROUTE_MAP.md`
- [x] `PUBLIC_PAGES_MASTER_SPEC.md`
- [x] `PUBLIC_PAGES_TODO.md`

## 1. Shared system
- [x] `public-lockup.tsx` (moved out of `(landing)`)
- [x] `public-locale-toggle.tsx` (moved out of `(landing)`)
- [x] `public-nav.tsx` — shared by landing + Knowledge Library
- [x] `public-footer.tsx` — redesigned, shared
- [x] `public-page-shell.tsx`
- [x] `public-page-hero.tsx` + `public-breadcrumb.tsx`
- [x] `public-section.tsx` (section, heading, editorial block)
- [x] `public-feature-grid.tsx`
- [x] `public-accordion.tsx`
- [x] `public-callout.tsx`
- [x] `public-cta.tsx`
- [x] `spotlight-card.tsx`
- [x] `public-background.tsx` (per-page motifs)
- [x] `(pages)` route group + layout + loading state
- [x] Landing layout switched to the shared nav/footer

## 2. Content
- [x] `publicPages` namespace — English
- [x] `publicPages` namespace — French
- [x] Every claim cross-checked against code

## 3. Pages
- [x] `/about` — 8 sections, editorial
- [x] `/faq` — search, categories, featured, accordions, deep links
- [x] `/confidentiality` — factual, section-by-section
- [x] `/contact` — situation routing, no invented inbox
- [x] `/signup` brand-panel copy
- [x] Auth footer links repointed at real pages

## 4. Wiring
- [x] `/confidentiality` + `/contact` added to the public allow-list
- [x] Footer + nav current-page state
- [x] CHANGELOG entry

## 5. Verification
- [x] Typecheck, lint, unit tests, production build
- [x] Browser pass — every page, EN + FR
- [x] Responsive 320 → 1920
- [x] Reduced motion
- [x] 200% zoom
- [x] Keyboard-only pass
- [x] Console / hydration errors
- [x] Horizontal overflow
- [x] Screenshots → `public-pages-evidence/`
- [x] `PUBLIC_PAGES_COMPONENT_MAP.md`
- [x] `PUBLIC_PAGES_ROUTE_AUDIT.md`
- [x] `PUBLIC_PAGES_IMPLEMENTATION_REPORT.md`
