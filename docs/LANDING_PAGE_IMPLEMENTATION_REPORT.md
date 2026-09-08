# BLAK MOH Landing Page — Implementation Report

**Concept:** The Mentorship Continuum — _"Experience becomes direction. Ambition becomes leadership."_
**Scope:** the public marketing route `/` only. **Date:** 25 July 2026.

---

## 1. What changed

The public homepage was replaced with a twelve-part cinematic narrative on a dark, editorial visual
system built from the actual BLAK MOH logo colours, with a custom WebGL hero.

`/` moved out of the `(public)` route group into a new `(landing)` group with its own dark chrome.
`/about`, `/faq` and `/design` stay in `(public)` behind the existing light `SiteHeader`/`SiteFooter`,
so **no other page changed appearance** — verified by screenshot
(`docs/landing-evidence/portal-unchanged/about.png`).

The narrative, in order: floating nav → cinematic hero → human problem statement → AI-assisted matching
(interactive) → the nine-month journey (pinned scroll chapter) → real mentorship tools → the bilingual
chapter → privacy and human control → programme structure → final transformation + CTA → footer.

### Content honesty

The previous homepage published **"120+ mentors"** and **"300+ mentees"**. Those trace to a *planned*
cohort size in the project brief, not to live data. They are **not on the new page**, and a unit test
now fails the build if a figure of that shape reappears in the landing copy. The Programme section
states only facts verifiable in this repository: 9 months, 9 stages, 2 languages, 6 matching criteria,
6 roles, 1 unbreakable rule. Nothing else on the page is invented — no testimonials, awards,
partnerships, certifications, client logos or outcome claims.

The matching demonstration is explicitly labelled as illustrative, uses fictional profiles, and is
wired to nothing. Its approval button reads "Simulate administrator approval".

---

## 2. Files changed

### Added — `src/app/(landing)/` (31 files)

```
layout.tsx  page.tsx  opengraph-image is NOT used (see §7)

components/   landing-nav · landing-footer · landing-lockup ·
              landing-locale-toggle · scroll-progress
sections/     landing-hero · section-problem · section-matching · section-journey ·
              section-tools · section-bilingual · section-privacy ·
              section-principles · section-transformation
three/        continuum-canvas · continuum-scene · continuum-stream · forms ·
              knowledge-core · camera-rig · quality-guard · hero-fallback
motion/       hero-reveal-text · reveal-text · scroll-reveal · counter
visuals/      light-field · glass-panel · film-grain
hooks/        use-reduced-motion · use-can-render-3d · use-in-view
```

### Added — elsewhere

- `tests/landing/landing-copy.test.ts` — 9 tests
- `tests/e2e/landing.spec.ts` — 8 Playwright tests
- `scripts/shot-landing.mjs` — evidence capture (viewport / full / section / scroll offset, locale,
  reduced-motion and WebGL-disabled variants)
- `LANDING_PAGE_MASTER_SPEC.md`, `LANDING_PAGE_TODO.md`, `LANDING_PAGE_COMPONENT_MAP.md`, this file
- `docs/landing-evidence/**` — before/after screenshots, Lighthouse reports, filmstrip

### Modified — shared files, all additive

| File                 | Change                                                          | Portal impact |
| -------------------- | --------------------------------------------------------------- | ------------- |
| `src/app/layout.tsx` | Adds Instrument Serif as `--font-serif`                          | none — nothing in the portal uses `font-serif` |
| `src/app/globals.css`| Adds `--blak-*` tokens + `.landing-*` styles. **No existing token value changed** | none |
| `tailwind.config.ts` | Adds `blak-*` colours, `font-serif`, 5 fluid font sizes          | none — additive |
| `messages/{en,fr}.json` | Adds the `landing` namespace                                 | none — `git diff` shows zero removed lines |
| `package.json`       | +`three`, `@react-three/fiber`, `gsap`, `motion`                 | none |

### Removed

- `src/app/(public)/page.tsx` — replaced by `src/app/(landing)/page.tsx`

**Not touched:** auth logic, database schema, matching engine, any dashboard, messages, goals,
meetings, sessions, journal, reviews, support, API contracts, or any shared portal component
(`SiteHeader`, `SiteFooter`, `BrandLogo`, `Wordmark`, `LocaleSwitcher`, every `ui/` primitive).

---

## 3. Design system

Greens and gold are **sampled pixel-exact** from `public/brand/blak-moh-original.png` using
`System.Drawing`, not eyeballed:

| Token             | Value     | Evidence                                   |
| ----------------- | --------- | ------------------------------------------ |
| `--blak-green`    | `#14B21F` | 26,497 opaque pixels — the primary logo green |
| `--blak-green-deep` | `#119A19` | 25,446 pixels — the script "m"            |
| `--blak-gold`     | `#CD9933` | the full stop after MOH                    |
| `--blak-text`     | `#F7F7F7` | the logo plate off-white                   |

Contrast on black: text 20.1:1 · secondary text 9.6:1 · green 7.4:1 · gold 8.2:1. The primary CTA is
logo green with near-black ink at **7.4:1**.

Two font families total: **Public Sans** (unchanged, all UI and body) and **Instrument Serif** (400 +
italic, used only for the second line of statements and pull quotes). Both self-hosted by `next/font`.

The logo is the **official supplied mark**, unaltered. The full lockup PNG could not be used on dark —
it has an opaque `#F7F7F7` plate and solid-black letterforms baked in — so the landing chrome uses the
transparent mark beside an HTML wordmark, which is the same lockup structure the portal already ships.

---

## 4. Performance

Measured against a **production build** (`next build` + `next start`), Lighthouse 12.8.2, **median of
three runs** each, with the dev server stopped to avoid CPU contention.

| Metric              | Desktop | Mobile | Target        |
| ------------------- | ------- | ------ | ------------- |
| Performance         | **81**  | **70** | as high as practical / mobile 85+ |
| Accessibility       | **100** | **100**| 95+ ✅        |
| Best practices      | **96**  | **96** | 95+ ✅        |
| SEO                 | 69      | 69     | 95+ — see §7  |
| LCP                 | **1.18 s** | 4.7 s | ≤ 2.5 s     |
| CLS                 | **0.0006** | **0.0010** | ≤ 0.1 ✅ |
| Total blocking time | 354 ms  | 524 ms | —             |
| JS transferred      | 611 KiB | **317 KiB** | —        |

Reports: `docs/landing-evidence/lighthouse/`.

### What the optimisation work actually found

Every change below was made because a measurement demanded it, and each is recorded with its number:

1. **`@react-three/drei` → 40 lines of our own code.** drei was pulled in for `AdaptiveDpr` and
   `PerformanceMonitor` alone, at 86 KiB transferred. Replacing them with `three/quality-guard.tsx`
   moved desktop performance **56 → 77** in one change. Largest single win of the build.
2. **The 3D bundle now waits for `requestIdleCallback`.** Importing `three` during hydration cost
   **1,280 ms of total blocking time**; the hero is already complete without it. TBT fell to ~400 ms.
3. **Capability detection moved out of the dynamic chunk.** It used to live inside `ContinuumCanvas`,
   which meant every phone downloaded ~430 KiB of `three` only to decide not to render a canvas.
   Mobile JS: **611 → 317 KiB**.
4. **The hero entrance is CSS with no JavaScript.** A Motion-driven hero cannot paint until React has
   hydrated, which put mobile LCP at 4.6 s. `HeroRevealText` is server-rendered with a CSS animation.
5. **~40 scroll reveals moved from Motion to CSS + one IntersectionObserver each.** Hydrating forty JS
   animators was a measurable share of mobile main-thread work; the result is visually identical.
6. **Film grain is a repeating 160×160 data-URI tile,** not a full-viewport `feTurbulence` filter, and
   it no longer uses `mix-blend-mode`. Blending a fixed full-screen layer forces the compositor to
   re-blend the entire screen on every paint.
7. **Five sections became server components.** They hold no state, so there was no reason to ship or
   hydrate them.

### The honest remaining number: mobile LCP

Mobile LCP is **4.7 s against a 2.5 s budget** and I could not get it under budget without a change
that is outside this task's scope. The cause is measured, not guessed:

> The largest client chunk on the landing page is **139.6 KiB of Sentry browser SDK**
> (`src/instrumentation-client.ts`). It is bundled and executed on **every page of the application**
> regardless of configuration — `enabled: Boolean(NEXT_PUBLIC_SENTRY_DSN)` switches off *reporting*,
> not the download, parse and init. Under Lighthouse's mobile profile (4× CPU throttle, slow 4G) that
> execution dominates the critical path.

For scale: the entire landing page's own JavaScript — Motion, the interactive matching demo, the
journey chapter, the nav — is **42 KiB**. Sentry is more than three times the rest of the page.

The visual reality is better than the number suggests. The Lighthouse filmstrip
(`docs/landing-evidence/filmstrip/`) shows the mobile hero fully painted — headline, sub-copy, both
CTAs — **by 1.9 s**, and Speed Index is 2.7 s. The 4.7 s figure is Lighthouse's simulated LCP under
4× CPU throttling.

**This is an owner decision, not a code fix I should make unilaterally** — it trades error monitoring
against mobile performance across the whole product. Options, in order of my preference:

1. Lazy-load Sentry behind `requestIdleCallback` app-wide (keeps monitoring, moves it off the critical
   path). Expected mobile performance: ~85+.
2. Load Sentry only on authenticated routes — the portal is where errors matter; the marketing page
   has almost no logic to fail.
3. Accept it. Desktop is comfortably green and the page paints fast in reality.

Desktop Core Web Vitals are **green on all three** (LCP 1.18 s, CLS 0.0006, and no long-task pattern
that would put INP at risk).

---

## 5. Accessibility

**Lighthouse accessibility: 100 on both desktop and mobile.** Three real defects were found and fixed
during the audit rather than papered over:

- an invalid `<dl>` — `dt`/`dd` were two `div`s deep inside the reveal wrapper;
- an invalid `<ol>` on the mobile journey — the reveal wrapper sat between the list and its `<li>`s;
- the decorative stage numeral failed 3:1; raised from 35% to 60% gold.

Also built in:

- semantic landmarks, a skip link as the first focusable element, exactly one `h1`, strict heading order;
- the matching criteria are a real `tablist` with roving `tabindex` and arrow/Home/End keys —
  covered by an e2e test;
- **nothing is conveyed by colour alone.** An ineligible profile in the matching demo is dimmed *and*
  struck through *and* says "Different language — not eligible";
- decorative canvas and SVG are `aria-hidden`; all text stays live DOM text;
- split headings expose one accessible string via `sr-only`, with the animated copy `aria-hidden` and
  `select-none` so copy-paste is clean;
- focus ring is brand green at 7.4:1 on black, applied globally inside `.landing-root`;
- no horizontal overflow at 320 px (e2e-tested); no hover-only information; no cursor-dependent
  functionality.

**Reduced motion** (`prefers-reduced-motion: reduce`): camera travel, particle travel, parallax,
scroll progress and every entrance are disabled; the journey drops the pin entirely and renders all
nine stages as a vertical stack; counters render final values immediately. An e2e test asserts all
nine stages are present and readable in that mode.

**No-JS**: the hidden state of every reveal is inside `@media (scripting: enabled)`, so with
JavaScript unavailable the full page renders rather than staying invisible.

---

## 6. Browser test results

Automated — all green:

- `npm run typecheck` — clean
- `npm run lint` — 0 errors. One warning in landing code (a one-shot WebGL capability probe that
  necessarily writes state in an effect); the other 20 are pre-existing elsewhere in the repo.
- `npm test` — **281 passed / 33 files**, including 9 new landing tests
- `npx playwright test tests/e2e/landing.spec.ts` — **8 passed**

Manually verified in a real browser against the production build:

| Check | Result |
| ----- | ------ |
| Nav links, both hero CTAs, `/login`, `/signup`, `/about`, `/faq` | all resolve, e2e-asserted |
| Anchor navigation | scrolls to 2006 px, section rests 104 px below the nav (= its `scroll-margin-top`) |
| EN ⇄ FR switch | translates every section; scroll position preserved; auth untouched |
| Mobile menu at 390 px | opens, closes on Escape, locks background scroll, Sign in stays visible outside it |
| Keyboard traversal + skip link | correct order, visible focus throughout |
| Reduced motion | all nine stages present, no pinning |
| WebGL disabled | designed CSS/SVG still renders, no blank canvas |
| 320 / 375 / 390 / 1024 / 1440 | no horizontal overflow at any width |
| Console | clean apart from two known local-only messages (see below) |

Two console messages appear locally and are **not** landing-page defects: React's dev-mode `eval()`
probe (blocked by the repo's CSP by design), and the Vercel Analytics script being blocked off-Vercel
(it is first-party `/_vercel/insights/*` when deployed there). Both are filtered explicitly in the e2e
console assertion rather than silently ignored.

Evidence: `docs/landing-evidence/before/` and `docs/landing-evidence/after/` — 1440×900, 1024×768,
390×844, 375×812 and 320×720, EN and FR, plus reduced-motion, WebGL-disabled and full-page captures.

---

## 7. Remaining limitations

1. **Mobile LCP 4.7 s** — cause identified and measured (Sentry SDK, §4). Needs an owner decision.
2. **SEO score is 69 and should stay there.** The single failing audit is `is-crawlable`: the site
   sends `noindex, nofollow` site-wide via `robots.ts` and an `X-Robots-Tag` header because it is a
   confidential internal portal. "Fixing" it would expose the programme to search engines. Title,
   description, canonical and Open Graph tags are all correct for internal link unfurls.
3. **No Open Graph image is generated.** The repo has no existing OG-image workflow, and adding a
   `next/og` route to a `noindex` internal portal is cost without benefit. Trivial to add later.
4. **`bf-cache` fails** — the page sends `cache-control: no-store` because it must check the session
   to redirect signed-in visitors. Lighthouse marks this "Not actionable"; it is inherent to the
   auth-aware landing page.
5. **React Bits source is not vendored.** Its components are distributed by copy-paste under
   MIT + Commons Clause, which is not worth inheriting into a client-owned corporate codebase for
   three visual effects. `LightField`, `RevealText`/`ScrollReveal` and `GlassPanel` are original
   implementations of those patterns, documented as such in the component map. No Pro code is used.
6. **The mentor form sits partly behind the headline** on desktop. This is deliberate — the camera
   aims left of centre so the composition balances against left-aligned editorial type — but it means
   the gold figure reads as a silhouette rather than a full form at 1440 px.

---

## 8. Owner decisions still required

1. **Mentor / mentee counts.** `120+` / `300+` are planning figures. Off the page until you confirm
   real numbers, or approve them as *targets* worded as such.
2. **Sentry on the marketing page** — see §4. My recommendation: idle-load it app-wide.
3. **Privacy Policy and Terms pages don't exist.** The footer links Confidentiality → `/faq` and omits
   Terms rather than shipping a 404. Confirm whether to author them.
4. **Support address.** The footer reuses `admin@blakmoh.com`, inherited from `/signup`. Confirm the
   real inbox before pilot.
5. **Dark logo lockup.** If a transparent dark-surface lockup (PNG or SVG) exists, supply it and it
   drops straight into `landing-lockup.tsx`.
6. **Indexing.** Confirm the site should remain `noindex`. I have assumed yes.

---

## 9. Status summary

| | |
| --- | --- |
| **Implementation status** | Complete |
| **Sections completed** | 12 of 12 |
| **Desktop** | Full WebGL hero, pinned nine-stage journey, pointer parallax |
| **Tablet** | Reduced particle budget, unpinned journey, touch-sized controls |
| **Mobile** | No WebGL (designed CSS/SVG hero), stacked journey, no scroll hijacking |
| **English** | Complete |
| **French** | Complete — key-parity and non-duplication enforced by unit test |
| **Accessibility** | 100 desktop / 100 mobile |
| **Performance** | 81 desktop / 70 mobile |
| **Core Web Vitals** | Desktop green (LCP 1.18 s, CLS 0.0006). Mobile CLS green, LCP over budget — §4 |
| **Blockers** | None in code. One owner decision (Sentry) gates mobile performance. |
| **Screenshots** | `docs/landing-evidence/before/`, `.../after/`, `.../portal-unchanged/` |
| **Reports** | `docs/landing-evidence/lighthouse/` · this file · spec · TODO · component map |
