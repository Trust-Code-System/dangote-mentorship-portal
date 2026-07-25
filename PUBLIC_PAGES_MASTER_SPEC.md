# PUBLIC PAGES MASTER SPEC — THE BLAK MOH KNOWLEDGE LIBRARY

The landing page tells the story. The Knowledge Library explains it: what the programme is,
how it works, how participants are protected, and where to get help.

Companion documents: `PUBLIC_PAGES_ROUTE_MAP.md` (discovery),
`PUBLIC_PAGES_COMPONENT_MAP.md` (motion/effect inventory),
`PUBLIC_PAGES_ROUTE_AUDIT.md` (link verification),
`PUBLIC_PAGES_IMPLEMENTATION_REPORT.md` (results), `PUBLIC_PAGES_TODO.md` (progress).

---

## 1. Scope

**In scope.** `/about`, `/faq`, `/confidentiality` (new), `/contact` (new public support),
the shared public navigation and footer, and the brand-panel copy on `/signup`.

**Out of scope, deliberately untouched.** Every authenticated route, the matching engine,
Prisma schema, auth behaviour, the private `/support` request workflow, `/design`.
The only files touched outside the public surface are:

- `src/lib/auth/auth.config.ts` — two additions to the public path allow-list. No gating logic changes.
- `src/components/auth/auth-card.tsx` — two placeholder footer links repointed at the real pages now.
- `src/components/auth/auth-shell.tsx` — brand-panel copy varies on `/signup` (§13 of the brief).

---

## 2. Route group architecture

```
src/app/(landing)/   — "/" only. Cinematic, WebGL, the most dramatic public page. Unchanged content.
src/app/(pages)/     — NEW. /about, /faq, /confidentiality, /contact. Shared PublicPageShell.
src/app/(auth)/      — /login, /signup, /forgot-password, /reset-password, /invite. Unchanged.
src/app/(public)/    — /design only (dev-gated component gallery). Keeps the legacy light chrome.
src/app/(dashboard)/ — the portal, including the private /support request page. Untouched.
```

`(landing)` and `(pages)` now share the **same** `PublicNav` and `PublicFooter` components, so
the chrome is literally the same code, not a copy that drifts.

`/about` and `/faq` move from `(public)` to `(pages)`. **URLs do not change** — route groups do
not appear in the path — so every existing link, bookmark and test keeps working.

### Why the public support page is `/contact`

`/support` is already the authenticated participant support-request page
(`src/app/(dashboard)/support`). A second `/support` route would be a duplicate-route build
error, and allow-listing `/support` as public would have exposed the private request page.
The public page is `/contact`, labelled **Support** in the navigation and footer.

---

## 3. Shared shell

```tsx
<PublicPageShell>          // skip link, dark root, film grain, nav + footer
  <PublicNav />            // shared with the landing page
  <main>
    <PublicPageHero />     // eyebrow · breadcrumb · h1 · lede · page motif
    …page sections…
    <PublicCTA />          // closing action band
  </main>
  <PublicFooter />         // shared with the landing page
</PublicPageShell>
```

`src/components/public/`

| Component | Kind | Role |
| --- | --- | --- |
| `public-page-shell.tsx` | server | Dark root, skip link, landmark order, grain |
| `public-nav.tsx` | client | Glass bar, active state, mobile sheet, locale, sign in, request access |
| `public-footer.tsx` | server | Programme · Access · Language columns, statement, current-page state |
| `public-lockup.tsx` | server | Official mark + wordmark (moved out of `(landing)`) |
| `public-locale-toggle.tsx` | client | EN/FR, `aria-pressed`, cookie action (moved out of `(landing)`) |
| `public-page-hero.tsx` | server | Shared hero: eyebrow, breadcrumb, h1, lede, motif slot |
| `public-breadcrumb.tsx` | server | Home → page |
| `public-section.tsx` | server | `PublicSection`, `PublicSectionHeading`, `EditorialBlock` |
| `public-feature-grid.tsx` | server | Asymmetric editorial grid (1 feature + 2 medium + N compact) |
| `public-accordion.tsx` | client | Accessible disclosure with animated height + deep links |
| `public-callout.tsx` | server | Bordered aside for notes and caveats |
| `public-cta.tsx` | server | Closing action band |
| `spotlight-card.tsx` | client | Pointer-follow border glow, opt-in, reduced-motion safe |
| `public-background.tsx` | server | Per-page CSS motif (path / mesh / veil / rays) |

Motion primitives are **reused, not duplicated**: `ScrollReveal`, `RevealText` and `FilmGrain`
are imported from `src/app/(landing)/`, exactly as `(auth)/layout.tsx` already imports
`FilmGrain`.

---

## 4. Navigation

One component, one visual language, one term for sign-in ("Sign in" — never "Login").

- Max width 1280px, floating glass bar, translucency deepens after 40px of scroll.
- Desktop link set on **Knowledge Library pages**: About · FAQ · Confidentiality · Support,
  with `aria-current="page"` and a green rule under the active page.
- Desktop link set on **the landing page**: its four narrative anchors + FAQ, with the existing
  in-view section tracking. Same chrome, same right cluster, same mobile sheet — the landing
  page's nav is its table of contents, and replacing it with cross-page links would break the
  scroll narrative and the existing E2E test.
- Right cluster everywhere: EN/FR · Sign in · Request access.
- Mobile: compact lockup, 44px menu button, disclosure sheet, Sign in always visible in the
  bar (never hidden behind the toggle), locale control inside the sheet.

---

## 5. Visual system

Tokens only — all already defined in `globals.css` and `tailwind.config.ts`:
`--blak-black`, `--blak-forest`, `--blak-forest-2`, `--blak-green`, `--blak-green-deep`,
`--blak-green-soft`, `--blak-gold`, `--blak-gold-soft`, `--blak-ivory`, `--blak-text`,
`--blak-text-2`, `--blak-border`, `--blak-glass`. No purple. No blue AI gradient.

**Surface rhythm.** Pages alternate deliberately so nothing reads as a stack of white cards:

```
hero  black + page motif
  ↓
band  forest (#061A0E)
  ↓
band  black
  ↓
band  ivory  ← the editorial "paper" section, one per page maximum
  ↓
band  forest-2
  ↓
CTA   black + green glow
```

**Type.** Inter for everything structural; the serif (`font-serif`, italic) only for one
expressive clause per statement. Headings use the existing `blak-hero` / `blak-statement` /
`blak-section` fluid clamps. Long-form copy is capped at `max-w-[68ch]` (≈620–760px). Body
copy never drops below 16px.

---

## 6. Page hero

420–620px desktop, 300–460px mobile. Never `100vh` — that is the landing page's alone.
Eyebrow → breadcrumb → h1 (masked word reveal) → lede → decorative rule that grows in.
Each page gets its own motif; all are CSS/SVG, none are WebGL.

---

## 7. Page specifications

### 7.1 `/about` — editorial

1. **Hero** — eyebrow "The programme", headline from approved `landing`/`about` copy, plus a
   restrained SVG of two forms joined by a path with nine milestone nodes, green→gold.
2. **Why BLAK MOH exists** — large serif statement left, explanation right, animated
   connection line between. Copy from `landing.problem` (approved).
3. **What makes it different** — asymmetric grid: one featured capability (matching), two
   medium (bilingual, goal coaching), four compact (sessions, private spaces, reviews,
   support). Every item verified against a shipped feature.
4. **The nine-month journey** — the nine stages exactly as `landing.journey.stages` defines
   them: Profile · Training · Matched · Agreement · Goals · Sessions · Mid-term review ·
   Final review · Certificate. Horizontal rail on desktop, vertical on mobile, progress tied
   to scroll position. **No scroll hijacking, no pinning.**
5. **Human-led intelligence** — AI proposes, a named human commits. Copy from
   `landing.privacy.items.approval`.
6. **Bilingual participation** — a true 50/50 split, EN and FR panels identical in weight,
   using the real interface strings already in `landing.bilingual`.
7. **Programme principles** — the six structural facts from `landing.principles.facts`
   (9 months, 9 stages, 2 languages, 6 criteria, 6 roles, 1 unbreakable rule). These are
   architecture, not participation statistics — nothing is invented.
8. **CTA** — Sign in · Request access · Read the FAQ.

### 7.2 `/faq` — a real help centre

- Hero with eyebrow "Help".
- **Client-side search** over question, answer and category text, accent- and
  case-insensitive, in both locales. Labelled input, clear button, live result count in an
  `aria-live` region, explicit no-results state. Zero network requests.
- **Categories**: Getting started · Access and accounts · Matching · Goals · Sessions and
  meetings · Messages and journal · English and French · Privacy · Reviews and completion ·
  Support. Selecting a category **preserves the search term**, and vice versa.
- **Featured questions** — six, above the full list.
- **Accordions** — real `<button aria-expanded aria-controls>` disclosures, animated height,
  chevron **and** a text state change, keyboard operable, `id`-addressable so
  `/faq#q-matching-how` opens and scrolls to that answer.
- **Still need help** — a substantial band that separates public help (`/contact`) from the
  private in-portal request (`/support`, after signing in).

Every answer is derived from shipped behaviour. Where a question would require a policy
decision the product has not made, it is not asked.

### 7.3 `/confidentiality` — calm, authoritative, factual

Informational, **not** a legal contract and not a replacement for the signed agreements at
`/agreements`. Each claim below was verified in code and is cited in the page's source
comments:

| Claim | Verified in |
| --- | --- |
| DMs are readable only by the two participants; admins are never participants | `src/features/messages/data.ts` |
| Journal entries are private to the author; the mentor sees one only when explicitly shared, and only for their own mentee; admins are never a viewer | `src/features/reflections/visibility.ts` (pure + unit-tested) |
| Mentor private notes are private to the mentor who wrote them | `src/features/reflections/actions.ts`, `data.ts` |
| Session logs **are** visible to administrators, read-only; mentor-private notes are excluded from that view | `src/app/(admin)/admin/sessions/page.tsx`, `src/features/admin/overview-data.ts` |
| Support requests are anonymous **to other participants only** — the programme team always sees who raised one | `src/features/support/data.ts` |
| The risk monitor uses counts and dates only, never content | `src/features/risk/rules.ts` |
| AI drafts session summaries, goals, reviews and translations from the content it is given; it does not read DMs or journal entries today | `src/features/sessions/summary.ts`, `goals/coach.ts`, `reviews/actions.ts`, `lib/translation/` |
| Any admin message-content override is off by default and would be logged | `CLAUDE.md` §10 |

The page states what administrators **can** see as plainly as what they cannot. Participant
responsibilities are expressed as programme expectations, not as legal obligations.

### 7.4 `/contact` — routing, not a form

No public contact form ships. The repository has no public intake endpoint, and inventing an
inbox is forbidden by §22 of the brief. Instead the page routes by situation:

- **I cannot sign in** → `/login`, `/forgot-password`, `/signup` (invite redemption).
- **I have an invitation problem** → `/signup`, with the three real invite states named.
- **I am a participant with a programme concern** → sign in, then `/support` (private).
- **I have a general question** → `/faq`, `/about`, `/confidentiality`.

Every card leads to a working route. The one placeholder in the codebase — the seeded
`admin@blakmoh.com` mailto — is surfaced **once**, clearly marked as the address to replace,
and flagged as an owner decision rather than dressed up as an official support desk.

A calm, non-alarming note states that the portal is not an emergency channel and that urgent
safety concerns belong with the organisation's own emergency procedures. No emergency number
is invented.

### 7.5 `/login` and `/signup`

Untouched functionally. `/signup` remains invite-redemption plus "ask your administrator",
because the access model **is** invitation-only. The only change is the brand-panel copy on
`/signup`, which now speaks about beginning the journey rather than continuing it.

---

## 8. Footer

Deep black, fine top border, restrained green glow, official lockup, programme statement,
then three columns: **Programme** (About · FAQ · Confidentiality · Support) · **Access**
(Sign in · Request access) · **Language** (EN/FR). Current page marked with `aria-current`
plus a visible green marker. No Privacy Policy or Terms link — neither route nor approved
copy exists, and pointing them at an unrelated page would be worse than omitting them.
No social links. Mobile stacks the columns; nothing becomes an accordion.

---

## 9. Motion

- `ScrollReveal` / `RevealText` (CSS-transition based, one IntersectionObserver each).
- Motion (`motion/react`) only where it already is: the nav entrance and the accordion height.
- **No GSAP, no React Three Fiber, no new packages** on Knowledge Library pages.
- Every animated background is CSS gradient work, one per page, `aria-hidden`.
- All of it collapses under `prefers-reduced-motion: reduce` via the existing globals rules.

---

## 10. Accessibility (WCAG 2.2 AA)

One `<h1>` per page · skip link first in tab order · `header`/`main`/`footer`/`nav` landmarks ·
visible 2px green focus ring (7.4:1 on black) · 44px minimum targets · accordion and search
fully keyboard operable · `aria-live` result count · decorative SVG `aria-hidden` · no text
inside a canvas · state never signalled by colour alone · readable at 200% zoom.

---

## 11. Performance

No new dependencies. No WebGL, no GSAP, no images beyond the existing 4KB brand mark. Every
page is a server component apart from the nav, locale toggle, accordion, FAQ explorer and
spotlight card. The content HTML is complete on first paint; motion only decorates it.
`noindex` behaviour is untouched.

---

## 12. Open owner items

1. **Support address.** `admin@blakmoh.com` is the seeded demo super-admin, used on `/signup`,
   the auth footer and now `/contact`. A real programme inbox is required before pilot.
2. **Transparent dark lockup.** `blak-moh-original.png` has an opaque plate, so the dark
   surfaces compose the mark with live text. A transparent lockup asset would drop straight in.
3. **Privacy Policy / Terms of Service.** No routes, no approved copy. Omitted from the footer.
4. **Formal confidentiality policy text.** The page describes system behaviour accurately; if
   the programme office has approved policy wording, it should replace the descriptive copy.
5. **Dead allow-list entries** `/programme`, `/mentor-guide`, `/mentee-guide` in
   `auth.config.ts` have no pages. Left as-is; removal is an owner call.
