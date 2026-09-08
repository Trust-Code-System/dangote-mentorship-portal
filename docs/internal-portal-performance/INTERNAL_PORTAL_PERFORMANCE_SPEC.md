# Internal Portal Performance Spec

**Product:** BLAK MOH Mentorship Portal (authenticated application)  
**Scope:** Flat button redesign + sidebar navigation responsiveness  
**Constraint:** Features removed = 0 · Routes removed = 0  
**Date:** 2026-07-25

---

## 1. Problem statement

Users notice a small but clear delay when clicking authenticated sidebar destinations (Dashboard, Meetings, Goals, Sessions, Messages, Calendar, etc.). Public landing/informational pages feel smooth. The issue is confined to the authenticated shell.

---

## 2. Architecture inventory (baseline)

### 2.1 Route groups and layouts

| Group | Layout | Shell | Notes |
|-------|--------|-------|-------|
| `src/app/layout.tsx` | Root | Fonts, next-intl, Analytics | Runs for all routes |
| `src/app/(dashboard)/layout.tsx` | Participant + shared pages | `AppShell` + `QuickActions` | Re-fetches shell data every navigation |
| `src/app/(admin)/layout.tsx` | Admin area | `AppShell` | Same shell-data pattern |
| `src/app/(auth)/layout.tsx` | Auth | — | Out of scope for flat buttons |
| `src/app/(landing)/layout.tsx` | Marketing | — | Keep cinematic; do not change |
| `src/app/(public)/layout.tsx` | Public pages | — | Out of scope |
| `src/app/(pages)/layout.tsx` | Misc pages | — | Out of scope |

### 2.2 Edge gating

- File: `src/proxy.ts` (Next.js 16 rename of middleware)
- Uses `NextAuth(authConfig).auth` — JWT session check only (no Prisma)
- Matcher excludes static assets
- Fine-grained RBAC remains in layouts + `requireRole()`

### 2.3 Sidebar navigation source

- Builder: `src/lib/nav/sections.ts`
- Presentation: `src/components/shell/app-shell.tsx` (client)
- Mechanism: `next/link` (prefetch enabled by default) — **not** `router.push` / `window.location`
- Active state: `usePathname()` + `aria-current="page"`
- Gap: **no pending/optimistic active state** on click

### 2.4 Participant sidebar routes

| Label key | Href |
|-----------|------|
| Dashboard | `/dashboard` or role default |
| My Pair | `/pair` |
| Goals | `/goals` |
| Sessions | `/sessions` |
| Messages | `/messages` |
| Meetings | `/meetings` |
| Calendar | `/calendar` |
| Journal | `/journal` |
| Agreements | `/agreements` |
| Mid-term Review | `/mid-term-review` |
| Final Review | `/final-review` |
| Certificate | `/certificate` |
| Notifications | `/notifications` |
| Support | `/support` |
| Help | `/help` |
| Profile | `/profile` (header/sidebar avatar) |

### 2.5 Admin sidebar routes

| Label | Href |
|-------|------|
| Dashboard | `/admin` |
| Matching | `/admin/matching` |
| Insights | `/admin/insights` |
| Programmes | `/admin/programmes` |
| Cohorts | `/admin/cohorts` |
| Imports | `/admin/imports` |
| Forms | `/admin/forms` |
| Goals | `/admin/goals` |
| Sessions | `/admin/sessions` |
| Meetings | `/admin/meetings` |
| Training | `/admin/training` |
| Mentors | `/admin/mentors` |
| Mentees | `/admin/mentees` |
| Invites | `/admin/invites` |
| Settings (Super Admin) | `/admin/settings` |
| Notifications | `/notifications` |
| Support queue | `/admin/support` |

### 2.6 Button system (before)

- Component: `src/components/ui/button.tsx`
- Primary uses `bg-gradient-to-b`, `shadow-glow`, hover shadow swap → raised/3D feel
- Secondary/destructive use `shadow-elevation`
- Tokens: `tailwind.config.ts` → `boxShadow.glow`, `elevation`, `elevation-lg`
- Related raised controls: `fab.tsx`, `quick-actions.tsx` launcher, Atlas launcher (component exists; not currently mounted in layouts)

### 2.7 Route transitions

- **No** authenticated `AnimatePresence mode="wait"` page exit animation found
- Landing-only `AnimatePresence mode="wait"` in journey/matching/tools sections — leave alone
- Group-level `loading.tsx` exists for `(dashboard)` and `(admin)` (generic skeletons)
- **No** per-route `loading.tsx` under individual destinations

### 2.8 Global providers (authenticated)

- Root: `NextIntlClientProvider` (full message catalog)
- Shell: client `AppShell` state (collapse, mobile drawer, notif dropdown)
- `QuickActions` mounted in dashboard layout
- AtlasCopilot component exists but is **not mounted** in layouts at baseline
- No global React Query provider

### 2.9 Heavy dependencies

| Dependency | Where used | Auth portal impact |
|------------|------------|--------------------|
| `three` / `@react-three/fiber` | `(landing)/three/*` via dynamic import | Already separated from auth |
| `gsap` | Landing journey section (dynamic) | Already separated |
| `recharts` | `features/admin/insights-charts.tsx` (static import from page) | Inflates Insights + shared admin graph |
| `xlsx` | `features/imports/parse.ts` | Server-side import path |
| `pdf-lib` | Agreement PDF generation | Server-side |
| `motion` | Mostly landing | Verify no auth import of heavy scenes |

---

## 3. Root-cause hypothesis (measured against code)

Ranked by expected impact on sidebar click → content:

1. **Shell layout data refetch on every navigation**  
   `(dashboard)/layout.tsx` and `(admin)/layout.tsx` each `await`:
   - `getCurrentUser()` (auth + Prisma roles)
   - `isMaintenanceMode()` (dashboard, non-admin path)
   - `getUnreadCount`
   - `getUserNotifications(userId, 6)` ← recent list for dropdown
   - Separate `prisma.user.findUnique` for avatar image (duplicate user read)
   - `countUnreadMessages` (participant) — relatively heavy count
   - Many `getTranslations(...)` namespaces for labels + nav  
   Layout re-execution blocks a snappy shell update even though `AppShell` is a client component.

2. **No immediate pending sidebar state**  
   Active styling waits for pathname commit. Feels like a dead click on slow RSC.

3. **Generic (not destination-shaped) loading UI**  
   Group `loading.tsx` helps, but does not match Meetings/Goals/Messages layouts; perceived wait is longer.

4. **Raised button styling**  
   Visual/paint cost is secondary; not the primary navigation delay. Still must be flattened per product requirement.

5. **Page-level data**  
   Destination pages correctly use `Promise.all` in several places (Goals, Meetings). Remaining delay is mostly layout + destination query time, not exit animations.

6. **Landing 3D**  
   Already dynamically imported; not expected in auth bundles. Verify with production build analyser after changes.

---

## 4. Performance targets

| Metric | Target |
|--------|--------|
| Visible click / pending sidebar feedback | < 100ms (immediate) |
| Content-area skeleton | < 200ms where possible |
| Shell remount across sibling routes | Must not occur |
| Exit animation blocking nav | Must be zero (already true; keep) |
| Features / routes removed | **Zero** |

Exact ms will vary with DB/network; document before/after rather than claim universal times.

---

## 5. Solution design (non-behaviour-changing)

### Phase A — Flat internal buttons
- Replace primary gradient + glow with solid green, thin border, 120–180ms color transitions
- Flatten secondary / destructive / FAB / quick-action launcher
- Preserve labels, permissions, loading, confirmations, a11y

### Phase B — Immediate navigation feedback
- Optimistic pending href on sidebar `Link` click
- Keep shell stable; content-area skeletons
- Optional thin top progress bar (non-blocking)
- Disable double-activation of the same pending destination

### Phase C — Shell data slim-down
- Include `image` on cached session user load → drop duplicate avatar query
- `React.cache` for maintenance flag read
- Defer recent notification **bodies** until dropdown open (keep unread badge count in layout)
- Keep all authz / maintenance / RBAC checks

### Phase D — Loading boundaries + bundles
- Route-shaped `loading.tsx` for key destinations
- Dynamic-import Recharts on Insights
- Confirm landing 3D stays out of auth chunks

### Out of scope / owner decisions
- Changing JWT lifetime or moving RBAC solely to client
- Cross-user caching of private data
- Index migrations without schema review (document candidates only unless justified)

---

## 6. Evidence locations

```text
internal-performance-evidence/
  before/
  after/
  navigation-timings/
  profiler/
  network/
  regression/
```

Companion docs (this folder: `docs/internal-portal-performance/`):
- `INTERNAL_PORTAL_PERFORMANCE_TODO.md`
- `INTERNAL_PORTAL_REGRESSION_MATRIX.md`
- `INTERNAL_PORTAL_PERFORMANCE_REPORT.md` (final)
