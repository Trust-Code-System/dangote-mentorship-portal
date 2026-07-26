# Full Platform Route Inventory

Generated from the successful Next.js production build and verified against the App Router source. “Browser pass” means the static route was opened with a real authenticated/public browser. Dynamic-ID routes were verified through safe owner/access tests or source/unit checks because inventing or mutating production IDs was prohibited.

## Public and authentication

| Route | Purpose | Required role | APIs/actions | Data dependencies | Tested | Result | Issue |
|---|---|---|---|---|---|---|---|
| `/` | Marketing landing | Public | Locale action | localized content, route-scoped 3D | Yes | Browser pass | — |
| `/about` | Programme information | Public | None | localized content | Yes | Browser/viewport pass | — |
| `/faq` | FAQ explorer | Public | None | localized FAQ content | Yes | Browser pass | — |
| `/contact` | Contact/request-access guidance | Public | None | localized content | Yes | Browser pass | — |
| `/confidentiality` | Privacy model | Public | None | localized policy content | Yes | Browser pass | — |
| `/design` | Non-production design gallery | Non-production public | None | components | Build/code | Correctly gated in production | — |
| `/login` | Credentials/optional Entra | Public | Auth.js sign-in | users, role grants, rate limiter | Yes | Browser pass | AUD-ENV-001 |
| `/signup` | Signup request surface | Public | signup action | users/profile | Yes | Browser render pass | — |
| `/forgot-password` | Reset request | Public | reset/mail action | users, tokens, mail provider | Safe code only | Mail blocked | AUD-ENV-001 |
| `/reset-password/[token]` | Password reset completion | Valid token | reset action | reset tokens/users | Unit/code | Logic pass; live mutation blocked | — |
| `/invite/[token]` | Invitation activation | Valid invite | invite action | invites/users/roles/mail | Unit/code | Logic pass; mail blocked | AUD-ENV-001 |
| `/maintenance` | Maintenance holding page | Public when enabled | settings read | platform settings | Code | Toggle not changed | — |
| `/programme` | Bilingual programme guide | Public | None | localized content | Yes | Production browser pass EN/FR | Fixed: AUD-ROUTE-001 |
| `/mentor-guide` | Bilingual mentor guide | Public | None | localized content | Yes | Production browser pass EN/FR | Fixed: AUD-ROUTE-001 |
| `/mentee-guide` | Bilingual mentee guide | Public | None | localized content | Yes | Production browser pass EN/FR | Fixed: AUD-ROUTE-001 |

## Participant routes

| Route | Purpose | Required role | APIs/actions | Data dependencies | Tested | Result | Issue |
|---|---|---|---|---|---|---|---|
| `/dashboard` | Role dispatch | Authenticated | Auth.js/RBAC | live user/roles | Yes | Redirect pass | — |
| `/dashboard/mentor` | Mentor overview | Mentor | dashboard/journey reads | matches, goals, meetings, sessions | Yes | Browser pass | — |
| `/dashboard/mentee` | Mentee overview | Mentee | dashboard/journey reads | match, goals, meetings, clinics | Yes | Browser pass; mobile fixed | AUD-RESP-001 |
| `/profile` | Current-user profile/avatar | Authenticated | profile/avatar actions | user, mentor/mentee profile, storage | Yes | Browser pass | AUD-AVATAR-001 |
| `/pair` | Current pair workspace | Mentor/Mentee | pair data | accepted matches | Yes | Browser pass, no reload | — |
| `/pair/[menteeId]` | Specific pair workspace | Related mentor/mentee | pair actions/data | matches, goals, sessions, agreements | Unit/code | Ownership pass | — |
| `/agreements` | Agreement sign/download | Pair participant | agreement action/PDF API | agreement snapshots, matches | Yes | Browser pass; scoped | — |
| `/goals` | Goal lifecycle/coach/evidence | Mentor/Mentee | goal/AI/upload actions | goals, reviews, storage | Yes | Browser/code pass; direct upload staging boundary pending | Fixed in code: AUD-UPLOAD-001 |
| `/sessions` | Session logs/actions/AI | Mentor/Mentee | session actions | sessions, action items, AI | Yes | Browser pass | AUD-AI-001 |
| `/meetings` | Schedule/confirm/cancel | Mentor/Mentee | meeting actions | meetings, Graph seam | Yes | Browser pass | AUD-ENV-001 |
| `/meetings/[id]/prepare` | Meeting preparation assistant | Meeting participant | meeting prep action | meeting, AI | Unit/code | Scoped; live AI blocked | AUD-AI-001 |
| `/calendar` | Calendar view | Authenticated participant | calendar reads | meetings/training/reviews | Yes | Browser pass | — |
| `/messages` | Conversation workspace | Conversation participant | message reads/actions | conversations/messages/reads/Realtime | Yes | Browser pass EN/FR; code hardened | Fixed in code: AUD-MSG-001, AUD-RT-001 |
| `/messages/[conversationId]` | Direct thread | Conversation participant | send/load/read actions | messages, notifications, Realtime | Unit/browser | Participant-scoped; migration/staging verification pending | Fixed in code: AUD-MSG-001, AUD-RT-001 |
| `/journal` | Reflections/mentor notes | Mentor/Mentee | reflection actions | reflections, shares, private notes | Yes | Browser/access pass | — |
| `/mid-term-review` | Mid-term response | Mentor/Mentee | review actions/AI | form definitions/responses | Yes | Browser pass; FR data dependent | AUD-I18N-002 |
| `/final-review` | Final response | Mentor/Mentee | review actions/AI | form definitions/responses | Yes | Browser pass; FR data dependent | AUD-I18N-002 |
| `/certificate` | Own completion certificate | Mentor/Mentee | certificate data/PDF API | match, training, goals, reviews | Yes | Browser/PDF/access pass | — |
| `/notifications` | Inbox/preferences | Authenticated | notification actions | notifications/preferences | Yes | Browser pass | — |
| `/support` | Support request | Authenticated participant | support actions | support requests | Yes | Browser pass | — |
| `/help` | Help index | Authenticated | None | localized articles | Yes | Browser pass | — |
| `/help/[slug]` | Help article | Authenticated | None | localized article map | Code | Not every slug opened | — |

## Super Admin routes

The application has one administrator role, `SUPER_ADMIN`. Programme Admin, Trainer and Reviewer are intentionally folded into it.

| Route | Purpose | Required role | APIs/actions | Data dependencies | Tested | Result | Issue |
|---|---|---|---|---|---|---|---|
| `/admin` | Operations dashboard | Super Admin | aggregate reads | programme/cohort/match/risk/support | Yes | Browser pass; chart warning fixed | Fixed: AUD-CHART-001 |
| `/admin/certificates` | Certificate management | Super Admin (cohort scope) | certificate PDF API | matches/completion evidence | Yes | Browser/PDF pass | — |
| `/admin/programmes` | Programme CRUD | Super Admin | programme actions | programmes | Yes | Browser render pass | — |
| `/admin/programmes/[id]/edit` | Programme editor | Super Admin | programme actions | programme | Code | Guard/action pass | — |
| `/admin/cohorts` | Cohort CRUD | Super Admin | cohort actions | cohorts/programmes | Yes | Browser render pass | — |
| `/admin/cohorts/[id]/edit` | Cohort editor | Super Admin | cohort actions | cohort/programme | Code | Guard/date validation pass | — |
| `/admin/imports` | CSV/XLSX upload | Super Admin | import upload | import tables, XLSX parser | Yes | Browser/code pass; direct upload staging boundary pending | Fixed in code: AUD-UPLOAD-001 |
| `/admin/imports/[id]` | Import validation/commit | Super Admin | import actions | import rows/profiles | Code | Guard/parser/localization pass | Fixed: AUD-I18N-002 |
| `/admin/matching` | Matching recommendations/approval | Super Admin | matching actions/AI rationale | profiles, criteria, matches | Yes | Browser render/hard-rule/localization pass | Fixed: AUD-I18N-002 |
| `/admin/mentors` | Mentor directory | Super Admin | profile reads | mentor profiles | Yes | Browser pass | — |
| `/admin/mentors/[id]` | Mentor detail | Super Admin | scoped profile reads | mentor/matches/activity | Code | Scope reviewed | — |
| `/admin/mentees` | Mentee directory | Super Admin | profile reads | mentee profiles | Yes | Browser pass | — |
| `/admin/mentees/[id]` | Mentee detail | Super Admin | scoped profile reads | mentee/matches/activity | Code | Scope reviewed | — |
| `/admin/invites` | Invite management | Super Admin | invite/mail actions | invites, roles, cohorts | Yes | UI pass; mail blocked | AUD-ENV-001 |
| `/admin/training` | Training overview | Super Admin | overview reads | profiles/training attendance | Yes | Browser pass | — |
| `/admin/forms` | Form definitions | Super Admin | forms actions | form definitions/questions | Yes | Browser pass | — |
| `/admin/forms/new` | Form builder | Super Admin | forms actions | form definitions/questions | Code | Render/action validation | — |
| `/admin/forms/[id]/edit` | Form editor | Super Admin | forms actions | form definition/questions | Code | Guard/action validation | — |
| `/admin/goals` | Programme goals | Super Admin | aggregate reads | cohort-scoped goals | Yes | Browser pass | — |
| `/admin/meetings` | Programme meetings | Super Admin | aggregate reads | cohort-scoped meetings | Yes | Browser pass | — |
| `/admin/sessions` | Session reports | Super Admin | aggregate reads | session logs excluding private notes | Yes | Browser pass | — |
| `/admin/insights` | Insights/risk/AI report | Super Admin | aggregate/AI reads | programme metrics | Yes | Browser pass; chart and application AI bounds fixed | Provider validation: AUD-AI-001 |
| `/admin/support` | Support queue | Super Admin | support actions | support requests | Yes | Browser pass | — |
| `/admin/settings` | Maintenance/platform settings | Super Admin | settings actions | platform settings | Yes | Render pass; mutation blocked | — |

## API and infrastructure routes

| Route | Purpose | Required role | Handler dependencies | Tested | Result | Issue |
|---|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | Auth.js endpoints | Public/session | Prisma, JWT, providers, Upstash | Yes | Login/session pass | AUD-ENV-001 |
| `/api/health` | Sanitized readiness | Public | Prisma | Yes | 200, DB up before/after load | — |
| `/api/avatar/[id]` | Private avatar stream | Authenticated viewer | private storage | Browser/code | 401 anonymous; missing object 404; UI fallback | AUD-AVATAR-001 |
| `/api/agreements/[id]/pdf` | Agreement PDF | Signer/scoped admin | agreement data, pdf-lib | Code/unit | Ownership guard present | — |
| `/api/certificates/[matchId]/pdf` | Certificate PDF | Owner/scoped admin | completion data, pdf-lib | Yes | 200 preview; 409 ineligible; unrelated 404 | — |
| `/api/goals/evidence/[id]` | Private evidence download | Owner/paired mentor/admin | evidence record, private storage | Unit/code | Ownership pass | — |
| `/api/cron/notifications` | Daily scheduler | Bearer cron secret | notifications/mail | Code | Secret guard; no manual production run | AUD-ENV-001 |

## Boundaries and non-route capabilities

- Root, auth, public, participant and admin layouts have loading/error handling; pair/messages also have leaf error boundaries to keep the shell mounted.
- No standalone user-management, roles, audit-log, clinic-management, forum, newsletter or programme-report route exists. These are **Not Implemented**, not hidden routes.
- The build also emits `_not-found`, `icon.png` and `robots.txt`; all are present.
