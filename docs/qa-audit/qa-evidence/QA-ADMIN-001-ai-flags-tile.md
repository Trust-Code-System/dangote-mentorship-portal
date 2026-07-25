# QA-ADMIN-001 — "AI flags" tile shows open-support count

**Severity:** P2 · **URL:** /admin · **Role:** Super Admin · **Env:** Prod + code · 2026-07-24

## Live observation
Admin dashboard third stat tile rendered: **"AI FLAGS  1"** (red tone). Clicking it navigates to `/admin/mentors`.

## Source evidence — `src/components/dashboard/admin-summary.tsx`
```tsx
<Tile
  href="/admin/mentors"          // ← unrelated destination
  label="AI flags"               // ← label says AI flags
  value={data.openSupport}       // ← value is the OPEN SUPPORT REQUEST count
  tone={data.openSupport > 0 ? 'risk' : 'default'}
  icon={<AlertTriangle className="size-5" />}
/>
```
`data.openSupport` originates from `src/features/dashboard/data.ts` (open support-request count), which has nothing to do with AI/risk-monitor flags.

## Why it's a defect
Label, value, and link disagree. An admin reading "AI flags: 1" is actually seeing "1 open support request", and clicking sends them to the mentor directory rather than support or insights.

## Recommended fix
Relabel to "Open support" + link `/admin/support`, OR wire to the risk-monitor flag count (`features/risk/data.ts`) + link `/admin/insights`.
