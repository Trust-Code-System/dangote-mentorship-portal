# QA-ADMIN-002 — "System health" tile mislabels match-rate, always green

**Severity:** P3 · **URL:** /admin · **Role:** Super Admin · **Env:** Prod + code · 2026-07-24

## Live observation
"SYSTEM HEALTH" tile showed **"3%"** with green ("ok") styling. Below, the "Program health" ring showed **3** with subtitle **"Healthy programme"**.

## Source evidence
`src/components/dashboard/admin-summary.tsx`:
```tsx
const matchRate = Math.round((data.activePairs / Math.max(1, data.activePairs + data.unmatchedMentees)) * 100);
...
<Tile href="/admin/insights" label="System health" value={`${matchRate}%`} tone="ok" ... />
```
`src/app/(admin)/admin/page.tsx`:
```tsx
const programHealth = Math.round((dashboard.activePairs / Math.max(1, dashboard.activePairs + dashboard.unmatchedMentees)) * 100);
...
<p className="... text-ink-3">Healthy programme</p>
```
With `activePairs=1`, `unmatchedMentees=43` → 1/44 ≈ 2–3%.

## Why it's a defect
The metric is a matching-completion rate, not "system health". Tone is hard-coded `ok` (green) and the subtitle is a constant "Healthy programme", so a brand-new cohort displays "3% — Healthy programme", which is contradictory/misleading.

## Recommended fix
Rename to "Match rate" (or compute a real composite), and derive tone + subtitle from thresholds.
