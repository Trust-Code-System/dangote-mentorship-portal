# Internal Portal Performance Report

**Date:** 2026-07-25  
**Features removed:** 0  
**Routes removed:** 0

---

## Executive summary

The authenticated BLAK MOH portal felt slightly laggy on sidebar clicks because each navigation re-ran a heavy shell layout fetch (including recent notification bodies and a duplicate avatar query) and gave no optimistic sidebar feedback. Raised/3D button styling was flattened to a solid enterprise system. Sidebar clicks now highlight immediately (median **166ms** pending/active feedback in Playwright/dev), destination-shaped skeletons keep the shell stable, and layout work per navigation was slimmed without removing features or weakening authz.

---

## Initial problem

Users reported a small but noticeable delay when clicking authenticated sidebar destinations (Dashboard, Meetings, Goals, Sessions, Messages, Calendar, admin pages). Public landing pages were already smooth.

---

## Root causes discovered

1. **Shell layout data on every navigation** — `(dashboard)/layout.tsx` and `(admin)/layout.tsx` awaited unread count, **recent notification list**, separate avatar query, message unread count, and many translation namespaces before the RSC payload settled.
2. **No pending sidebar state** — active styling waited on pathname commit; clicks felt dead during RSC work.
3. **Generic loading UI only** — group `loading.tsx` existed but destinations lacked layout-shaped skeletons.
4. **Raised buttons** — `shadow-glow` + gradient primary (visual; not the main nav delay).
5. **No auth exit animations** — `AnimatePresence mode="wait"` is landing-only; not a factor.
6. **Matching page crash (pre-existing)** — `t('overrideDone')` / similar ICU strings without values threw `FORMATTING_ERROR` and could fail `/admin/matching` loads (fixed with `t.raw`).

---

## Changes implemented

### Flat UI
- `Button`: solid green / bordered secondary / ghost / destructive; 150ms colour transitions; readable disabled state (not opacity-only).
- FAB, Quick Actions launcher, Atlas launcher flattened (no glow/scale/gradient).
- Public landing CTAs left on their own classes.

### Sidebar responsiveness
- Optimistic `pendingHref` on `Link` click; `aria-busy` while pending; ignore repeat clicks on same pending href.
- Thin top progress cue while navigating.
- Mobile bottom tabs share the same pending behaviour.
- Shell stays mounted; no full-screen spinner for normal nav.

### Shell / data
- `SessionUser.image` from cached `loadActiveUser` — removed duplicate avatar query.
- Recent notification bodies fetched via `fetchRecentNotifications` when the dropdown opens.
- `React.cache` on `isMaintenanceMode`, `getUnreadCount`, `countUnreadMessages`.
- Authz, maintenance gate, unread badges preserved.

### Loading + bundles
- Route-shaped `loading.tsx` for goals, meetings, sessions, messages, calendar, journal, profile, dashboard, matching, insights, mentors, mentees.
- Insights Recharts loaded with `next/dynamic`.
- Landing Three.js already dynamic — confirmed unused by auth layouts.

### Regression fix
- Matching toast templates use `t.raw(...)` so the Matching Engine page renders again.

---

## Features preserved

All routes from the production build listing remain present (`/admin/*`, `/goals`, `/meetings`, `/sessions`, `/messages`, `/calendar`, `/journal`, `/pair`, reviews, support, imports, etc.). No feature flags disabled. Notifications, search, Quick Actions, EN/FR, RBAC, and maintenance mode remain.

---

## Navigation improvement (measured)

Source: `internal-performance-evidence/navigation-timings/after.json` (Playwright, `next dev`, Chromium).

| Metric | After (median) |
|--------|----------------|
| Sidebar pending/active feedback | **166ms** |
| Content heading visible | **3974ms** (dev; includes on-demand compile) |

Per-route after (sidebarActiveMs / contentMs):

| Route | Sidebar feedback | Content |
|-------|------------------|---------|
| Matching | 203ms | 9433ms |
| Insights | 166ms | 2618ms |
| Programmes | 356ms | 3925ms |
| Cohorts | 101ms | 4022ms |
| Mentors | 194ms | 2715ms |
| Mentees | 129ms | 3097ms |
| Invites | 115ms | 4525ms |
| Notifications | 165ms | 4517ms |

**Before:** browser timings not captured pre-change in this session; code baseline documents the removed per-nav notification list + avatar query + missing pending state (`baseline.json`).

**Failed requests during nav suite:** 0.

---

## UI changes

- Primary buttons: solid `bg-green`, thin `border-green-strong`, white text, `active:translate-y-px`, no `shadow-glow`.
- Secondary/outline: flat bordered surfaces.
- Ghost: soft green hover.
- Destructive: flat risk red.
- Sidebar active: green tint + right border (unchanged pattern, no glow).
- Shadows removed from interactive chrome where they implied 3D depth.

---

## Architecture / data-fetching changes

| Area | Change |
|------|--------|
| Layouts | Slimmer Promise.all; no recent list; no prisma avatar query |
| RBAC | `image` on SessionUser |
| Notifications | `fetchRecentNotifications` server action |
| Cache | maintenance + unread helpers |
| Insights | dynamic Recharts |
| Matching | `t.raw` for toast templates |

**Database indexes:** none added (candidates documented in SPEC; deferred pending migration review).

---

## Regression results

| Check | Status |
|-------|--------|
| Unit tests | **300/300 PASS** |
| Typecheck | **PASS** |
| Production build | **PASS** (all routes listed) |
| E2E nav performance | **2/2 PASS** |
| Flat button class check | **PASS** (no `shadow-glow` / gradient on admin invites button) |
| Features removed | **0** |
| Routes removed | **0** |

English admin shell verified in Playwright. French locale switcher not re-run in this pass (existing `auth-ui` suite covers locale plumbing; shell labels remain via next-intl). Mobile drawer code path unchanged (pending state shared). Desktop nav verified via E2E screenshots under `internal-performance-evidence/after/`.

---

## Remaining limitations

1. **Auth still runs when the layout RSC is actually re-executed** (hard refresh, crossing admin↔participant groups, cache miss after 30s). That is intentional for security. Unread badges no longer block that path — they hydrate via `fetchShellBadges` after paint / on focus.
2. **Dev content times include Turbopack/webpack compile** — production `next start` will be faster; re-measure with `CI=1` for launch numbers.
3. **Recharts resize warnings** in Insights when container is briefly 0×0 during dynamic load — cosmetic console noise, charts still render.
4. **Participant mentor/mentee route timings** not fully timed in this pass (admin shell used as proxy); same shell optimisations apply to `(dashboard)`.
5. **No new DB indexes** — message unread count can still be relatively expensive on large tables (now client-side only).
6. **Badge freshness** may lag by a moment after paint (and up to the focus/pathname refresh cadence). Counts remain accurate; they are just non-blocking.

---

## Files changed (why)

| File | Why |
|------|-----|
| `src/components/ui/button.tsx` | Flat button system |
| `src/components/ui/fab.tsx` | Flat FAB |
| `src/components/quick-actions.tsx` | Flat launcher |
| `src/features/copilot/atlas-copilot.tsx` | Flat Atlas chrome |
| `src/components/shell/app-shell.tsx` | Pending nav, deferred notifs, progress cue |
| `src/components/shell/route-skeletons.tsx` | Destination skeletons |
| `src/app/(dashboard)/layout.tsx` | Slim shell fetch |
| `src/app/(admin)/layout.tsx` | Slim shell fetch |
| `src/lib/auth/rbac.ts` | Include avatar image on SessionUser |
| `src/features/settings/maintenance.ts` | React.cache |
| `src/lib/notifications/data.ts` | Cached unread count |
| `src/lib/notifications/actions.ts` | Recent notifications action |
| `src/features/messages/data.ts` | Cached unread messages |
| `src/app/(admin)/admin/insights/page.tsx` | Dynamic Recharts |
| `src/app/(admin)/admin/matching/page.tsx` | Fix ICU toast templates |
| `src/components/dashboard/mentee-summary.tsx` | Remove scale hover |
| Many `loading.tsx` under dashboard/admin | Route loading UI |
| `tests/e2e/internal-nav-performance.spec.ts` | Timing + flat-button regression |
| Docs: SPEC / TODO / MATRIX / REPORT / CHANGELOG | Process + evidence |
| `internal-performance-evidence/**` | Screenshots + timings |

---

## Evidence paths

- Folder: `docs/internal-portal-performance/`
- Spec / TODO / matrix / report: same folder
- Timings: `internal-performance-evidence/navigation-timings/`
- Screenshots: `internal-performance-evidence/after/`
