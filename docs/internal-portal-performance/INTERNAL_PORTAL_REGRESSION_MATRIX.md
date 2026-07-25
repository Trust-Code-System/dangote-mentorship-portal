# Internal Portal Regression Matrix

**Rule:** Features removed = 0 · Routes removed = 0  
**Statuses:** `PASS` · `FAIL` · `BLOCKED` · `PENDING` · `N/A`

Pre-change status = feature existed and was reachable before optimisation.  
Post-change is filled during Phase 7–8 verification.

---

## Authentication & shell

| Feature | Route | Role | Existing behaviour | Test data | Pre | Post | Evidence |
|---------|-------|------|--------------------|-----------|-----|------|----------|
| Login | `/login` | all | Email/password → role dashboard | seed admin | PASS | PASS | e2e nav + invites |
| Logout | shell | all | Sign-out returns to login | session | PASS | PASS | shell form intact |
| Session persistence | * | all | Refresh keeps session | JWT | PASS | PASS | unchanged auth |
| Role redirect | `/dashboard` | admin | Admins land `/admin` | admin | PASS | PASS | e2e sign-in |
| Expired session | protected | all | Redirect login | — | PASS | PASS | proxy unchanged |
| EN / FR UI | shell | all | Locale switcher persists | cookie | PASS | PASS | next-intl preserved |
| Maintenance mode | `/maintenance` | non-admin | Lockout when flag on | feature flag | PASS | PASS | layout gate kept |
| Sidebar pending feedback | * | all | Immediate active/pending | — | N/A (new) | PASS | nav e2e ~166ms median |
| Flat buttons | * | all | Actions still work | — | PASS (3D) | PASS | no shadow-glow |

## Profile

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Edit / save profile | `/profile` | user | PASS | PENDING | |
| Upload photo | `/profile` | user | PASS | PENDING | |
| Remove photo | `/profile` | user | PASS | PENDING | |
| Reload persistence | `/profile` | user | PASS | PENDING | |

## Matching (admin + pair)

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Run matching | `/admin/matching` | admin | PASS | PASS | page loads after t.raw fix; e2e nav |
| Review suggestions | `/admin/matching` | admin | PASS | PASS | page renders |
| Approve / override | `/admin/matching` | admin | PASS | PASS | actions preserved |
| Accept / decline | `/pair` | mentor/mentee | PASS | PENDING | |
| EN/FR language hard rule | engine | system | PASS | PENDING | unit tests |

## Agreements

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| View / sign | `/agreements` | pair | PASS | PENDING | |
| Duplicate-sign protection | `/agreements` | pair | PASS | PENDING | |
| Download PDF | `/agreements` | pair | PASS | PENDING | |

## Goals

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Create / edit / submit | `/goals` | mentee | PASS | PENDING | |
| AI Goal Coach | `/goals` | mentee | PASS | PENDING | |
| Mentor review / approve / changes | `/goals` | mentor | PASS | PENDING | |
| Evidence upload / progress | `/goals` | pair | PASS | PENDING | |
| Admin goals list | `/admin/goals` | admin | PASS | PENDING | |

## Meetings & calendar

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Schedule / cancel / confirm | `/meetings` | pair | PASS | PENDING | |
| Calendar display | `/calendar` | pair | PASS | PENDING | |
| Meeting prepare | `/meetings/[id]/prepare` | pair | PASS | PENDING | |
| Admin meetings list | `/admin/meetings` | admin | PASS | PENDING | |

## Sessions

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Create log / AI structure | `/sessions` | mentor | PASS | PENDING | |
| Action items / reflection | `/sessions` | pair | PASS | PENDING | |
| Admin sessions list | `/admin/sessions` | admin | PASS | PENDING | |

## Messages

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Open / send / unread | `/messages` | pair | PASS | PENDING | |
| Reload persistence | `/messages` | pair | PASS | PENDING | |
| Admin metadata-only | — | admin | PASS | PENDING | confidentiality |

## Journal & support

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Journal CRUD / share | `/journal` | pair | PASS | PENDING | |
| Mentor private notes | `/journal` | mentor | PASS | PENDING | |
| Support request | `/support` | participant | PASS | PENDING | |
| Admin support queue | `/admin/support` | admin | PASS | PENDING | |

## Reviews & forms

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Mid-term / final | `/mid-term-review`, `/final-review` | pair | PASS | PENDING | |
| Forms builder | `/admin/forms` | admin | PASS | PENDING | |
| Insights / AI report surfaces | `/admin/insights` | admin | PASS | PASS | e2e nav + dynamic charts |

## Notifications

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Open / mark read / prefs | `/notifications` | all | PASS | PASS | e2e nav to page |
| Shell unread badge | shell | all | PASS | PASS | still layout-fetched |
| Shell recent dropdown | shell | all | PASS | PASS | deferred fetch on open |

## Admin platform

| Feature | Route | Role | Pre | Post | Evidence |
|---------|-------|------|-----|------|----------|
| Programmes / cohorts CRUD | `/admin/programmes`, `/admin/cohorts` | super | PASS | PENDING | |
| Imports CSV/Excel | `/admin/imports` | admin | PASS | PENDING | |
| Mentors / mentees lists | `/admin/mentors`, `/admin/mentees` | admin | PASS | PENDING | |
| Invites | `/admin/invites` | admin | PASS | PENDING | |
| Training | `/admin/training` | admin | PASS | PENDING | |
| Settings / maintenance | `/admin/settings` | super | PASS | PENDING | |
| Global search | shell | all | PASS | PENDING | |
| Quick actions | FAB | pair | PASS | PENDING | |
| Atlas copilot | launcher | (when mounted) | PASS | PENDING | component preserved |

## Accessibility & responsive

| Check | Pre | Post | Evidence |
|-------|-----|------|----------|
| Keyboard focus on buttons/links | PASS | PENDING | |
| `aria-current="page"` sidebar | PASS | PENDING | |
| 44px touch targets (practical) | PASS | PENDING | |
| Reduced motion | PASS | PENDING | |
| Mobile drawer + bottom tabs | PASS | PENDING | |
| Widths 320–1920 | PASS | PENDING | |
| Long FR labels | PASS | PENDING | |

## Route inventory (must remain)

All routes listed in SPEC §2.4–2.5 plus nested detail routes (`/pair/[menteeId]`, `/messages/[conversationId]`, `/admin/imports/[id]`, etc.) must remain reachable. Removal count target: **0**.

---

## Navigation timing log template

See `internal-performance-evidence/navigation-timings/baseline.json` and `after.json` (filled by Playwright).

Fields per route: `clickTs`, `activeSidebarMs`, `urlChangeMs`, `loadingUiMs`, `contentMs`, `requestCount`, `failedRequests`, `mode` (`dev`|`production`).
