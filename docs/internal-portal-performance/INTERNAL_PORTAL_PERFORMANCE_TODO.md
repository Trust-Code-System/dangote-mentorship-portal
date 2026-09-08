# Internal Portal Performance TODO

Progress: `[ ]` not started · `[~]` in progress · `[x]` completed · `[!]` blocked

---

## Phase 1 — Baseline

- [x] Inspect authenticated layouts and shell
- [x] Inventory sidebar routes (participant + admin)
- [x] Identify button variants and raised/3D styling
- [x] Search for blocking route transitions — none in auth
- [x] Identify providers, proxy/middleware, layout queries
- [x] Identify heavy deps
- [x] Create SPEC / TODO / REGRESSION_MATRIX
- [x] Create `internal-performance-evidence/` folders
- [x] Capture navigation timings (Playwright after optimisations + code baseline)
- [x] Capture after screenshots (Playwright)
- [x] Production build route inventory verified

## Phase 2 — Flat UI

- [x] Flatten `Button` variants
- [x] Flatten FAB / Quick Actions launcher
- [x] Flatten Atlas launcher styling
- [x] Improve disabled contrast
- [x] Focus rings retained
- [x] Public landing CTAs unchanged

## Phase 3 — Immediate navigation feedback

- [x] Pending sidebar state on click
- [x] Prevent repeated clicks on same pending href
- [x] Keep `next/link` + prefetch
- [x] Thin top progress indicator
- [x] Confirm no exit-animation gate

## Phase 4 — Shell stability

- [x] AppShell stays mounted across sibling navigations
- [x] Content-area skeletons only
- [x] Notification dropdown fetch on open

## Phase 5 — Data fetching

- [x] Add `image` to cached SessionUser
- [x] Remove duplicate avatar query from layouts
- [x] `React.cache` maintenance flag
- [x] Defer recent notification list to dropdown open
- [x] Keep unread count + message badge in layout
- [x] Matching ICU crash fixed (`t.raw`)
- [!] New DB indexes — deferred (owner review; no unsafe migration)

## Phase 6 — Bundles

- [x] Dynamic-import Insights Recharts
- [x] Landing Three.js already separated from auth
- [x] Production build green

## Phase 7 — Route loading UI

- [x] Goals / Meetings / Sessions / Messages / Calendar / Journal / Profile / Dashboard
- [x] Admin matching / insights / mentors / mentees
- [x] Reduced-motion-friendly skeletons

## Phase 8 — Regression & production verification

- [x] Unit tests 300/300
- [x] Typecheck
- [x] Nav performance E2E 2/2
- [x] Production build
- [~] Full FR / mobile matrix (shell i18n intact; dedicated FR/mobile pass not fully re-run)
- [x] Write `docs/internal-portal-performance/INTERNAL_PORTAL_PERFORMANCE_REPORT.md`
- [x] Move performance markdown into `docs/internal-portal-performance/`
- [x] Non-blocking shell badges + `staleTimes.dynamic: 30`
- [x] CHANGELOG one-liner

---

## Non-negotiables (always)

- [x] Features removed: **0**
- [x] Routes removed: **0**
- [x] No weakening of server-side authz
- [x] No removal of loading/error/empty states
- [x] No public landing redesign
