# Navigation & Cache Refinement Report

**Date:** 2026-07-25  
**Scope:** Sidebar Active / Pending / Inactive states, route loading boundaries, Next.js client-router stale-while-revalidate  
**Features removed:** 0  
**Routes removed:** 0

---

## Exact cause of the double-active state

In `src/components/shell/app-shell.tsx`, pending and committed destinations shared one visual flag:

```ts
const highlighted = active || pending;
// …same classes for both…
```

On click:

1. The current route stayed `active` (pathname had not committed yet).
2. The clicked route set `pendingHref` and also received `highlighted`.
3. Both items rendered the full green active chrome for 1–2 seconds until the RSC navigation finished.

`aria-current="page"` was only on the committed route, but the **visual** design made both look selected.

---

## Exact cause of remaining content delay

Authenticated pages are dynamic Server Components. First visits must wait for the RSC payload (DB + authz). Prior work already slimmed the shell layout; remaining delay is destination page data, not shell chrome.

Repeat visits were slower than necessary when aggressive `router.refresh()` after every navigation invalidated neighbouring prefetched routes (Next.js 16 eagerly re-prefetches in-viewport Links on refresh).

---

## Existing caching system found

| Layer | Present? | Notes |
|-------|----------|--------|
| TanStack Query | No | Not in `package.json` |
| SWR | No | Not in `package.json` |
| Next.js client Router Cache | Yes | `experimental.staleTimes` already set |
| Server `revalidatePath` | Yes | Used across feature mutations |
| React `cache()` | Yes | RBAC / maintenance / unread helpers |
| Realtime (messages) | Yes | Supabase; left untouched |

**Decision:** Do **not** add TanStack Query or SWR. The App Router client cache + destination `loading.tsx` + focused soft refresh solves the UX without a broad rewrite.

---

## Changes made

### 1. Three sidebar states (Active / Pending / Inactive)

- Pure helper: `src/components/shell/nav-item-state.ts` (unit-tested).
- **Active:** full green fill + right border; only when committed and no pending nav.
- **Pending:** subtle green tint/outline + 14px spinner; `aria-busy`; no `aria-current` steal; never full active chrome.
- **Inactive:** default.
- While pending, the previous route loses full active chrome so two items never look equally selected.
- Stuck-pending timeout (12s); newest click wins; same-route click does not arm pending.
- `data-nav-state` for tests and debugging.

### 2. Immediate transitions + measured prefetch

- Sidebar / mobile tabs still use Next.js `Link` (no `window.location`, no delayed `router.push`).
- `prefetch={false}` on nav Links to avoid viewport-wide prefetch stampede.
- `router.prefetch(href)` on pointer enter / keyboard focus (deduped per session).
- Shell + header stay mounted; only `<main>` content swaps.

### 3. Route-level loading boundaries

Added destination-shaped `loading.tsx` (inside AppShell) for:

- Admin: overview, programmes, cohorts, imports, forms, goals, sessions, meetings, training, invites, settings, support; Insights uses chart-card skeleton.
- Participant: notifications, support, agreements, pair.

Existing goals / meetings / sessions / messages / calendar / journal / profile / dashboard / matching / mentors / mentees skeletons retained.

### 4. Stale-while-revalidate (Next.js router cache)

- `staleTimes.dynamic: 60`, `staleTimes.static: 300`.
- First visit: normal RSC + skeleton.
- Repeat visit within window: cached RSC shown immediately.
- Quiet background refresh on **window focus / visibility** (not every sidebar click), with “Updating” / “Mise à jour” indicator (≥150ms to avoid flicker).
- Mutations keep using `revalidatePath` + existing `router.refresh()` on the mutated screen.

### 5. Cache security

- Router cache is memory / tab session only — not `localStorage` for private page data.
- Collapse preference remains the only shell `localStorage` key.
- Logout full navigation clears JS memory (visited/prefetch sets).
- Server `requireUser` / `requireRole` unchanged on every page and action.
- Messages realtime subscriptions unchanged.

---

## Routes prefetched

Intent-based only (hover/focus/click) for all sidebar and mobile primary destinations: `/admin`, `/admin/matching`, `/admin/insights`, `/admin/programmes`, `/admin/cohorts`, `/admin/imports`, …, participant `/goals`, `/sessions`, `/meetings`, `/messages`, etc. No private dataset prefetch beyond the normal RSC route payload.

---

## Loading boundaries added

| Path | Skeleton |
|------|----------|
| `admin/loading.tsx` | Dashboard cards |
| `admin/programmes`, `cohorts`, `imports`, `forms`, `invites`, `training`, `settings`, `support` | Admin table |
| `admin/goals` | Goals |
| `admin/sessions` | Sessions |
| `admin/meetings` | Meetings |
| `admin/insights` | Insights chart cards |
| `notifications`, `support`, `agreements` | Table |
| `pair` | Dashboard cards |

---

## Data cached / not cached

**Cached (client router, ~60s dynamic):** previously visited authenticated RSC payloads for sidebar destinations.

**Deliberately not cached in localStorage / not introduced as a global client store:**

- Direct message bodies
- Mentor private notes / journal content
- Admin override message content
- Arbitrary mutation responses beyond Next’s per-tab router cache

**Still server-authoritative:** authz, roles, cohort scoping, soft-delete.

---

## Cache invalidation rules

| Event | Behaviour |
|-------|-----------|
| Successful feature mutation | Existing `revalidatePath` (+ often `router.refresh()` on that screen) |
| Tab focus / visibility | Soft `router.refresh()` of current route + Updating indicator |
| staleTimes expiry | Next navigation refetches |
| Logout / full navigation | Client memory cleared |
| Rapid sidebar clicks | No per-nav `router.refresh()` (preserves neighbour cache hits) |

---

## Security protections

- No new global private data cache.
- No sensitive persistence in `localStorage`.
- Server authz unchanged.
- Realtime messaging untouched.
- Pending/active UI is presentation-only; never grants access.

---

## Before and after timings

### Prior session (dev, previous optimisation)

Source: earlier `navigation-timings/after.json` (dev): median sidebar feedback **166ms**, median content **3974ms**.

### This pass (production, `CI=1` Playwright)

Source: `internal-performance-evidence/navigation-timings/after.json`

| Metric | After (production) |
|--------|--------------------|
| Median sidebar feedback | **57ms** |
| Median content heading | **2065ms** |
| Median URL change | ~**86ms** |
| Failed requests | **0** |

### Repeat visits (production)

Source: `navigation-timings/repeat-visits.json`

| Transition | First | Second (cached) |
|------------|-------|-----------------|
| Insights | 1968ms | **153ms** |
| Programmes | 1955ms | **81ms** |

---

## Features / routes removed

- Features removed: **zero**
- Routes removed: **zero** (production build still lists all prior authenticated routes)

---

## Desktop / mobile / EN / FR

| Surface | Status |
|---------|--------|
| Desktop sidebar | Pass — unit + Playwright chromium production |
| Mobile bottom tabs + drawer | Same pending/active logic; drawer closes on commit |
| English | Pass (`shell.updating` / `shell.navigating`) |
| French | Pass (`Mise à jour` / `Chargement de la page`) |

---

## Remaining limitations

1. First visit to a heavy page (e.g. Matching) still waits on server data; skeleton covers the gap.
2. Next.js 16 `router.refresh()` still eagerly touches in-viewport Links — hence focus-only soft refresh, not every nav.
3. Client router cache is per-tab; hard refresh always hits the server.
4. Playwright recorded one flaky Matching heading timeout under load (retry passed); Matching data work remains the slowest first visit (~4s).
5. Full manual matrix (offline, role switch, revoked permissions mid-session) not exhaustively exercised beyond production e2e + unit tests in this pass.

---

## Test evidence

- Unit: `tests/unit/nav-item-state.test.ts` — 4/4 passed  
- E2E production: `tests/e2e/internal-nav-performance.spec.ts` — 3/3 passed (`CI=1`)  
- Typecheck: clean  
- Production build: all routes present  
