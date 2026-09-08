# Platform Route Inventory

**Status:** completed discovery snapshot. The `Pending` cells below preserve the audit-entry state and are not current results. The authoritative post-test inventory, including restored/new certificate routes and route-level evidence, is `FULL_PLATFORM_ROUTE_INVENTORY.md`.

| Route | Purpose | Required role | Main data/API dependency | Audit result |
|---|---|---|---|---|
| `/` | Public landing experience | Public | Static content, 3D client bundle | Pending |
| `/about` | Programme information | Public | Localized content | Pending |
| `/faq` | Programme FAQ | Public | Localized FAQ data | Pending |
| `/contact` | Access/support contact | Public | Localized content | Pending |
| `/confidentiality` | Confidentiality information | Public | Localized content | Pending |
| `/design` | Public design reference page | Public | Static content | Pending |
| `/login` | Credentials and optional Entra login | Public | Auth.js | Pending |
| `/signup` | Account signup surface | Public | Auth.js | Pending |
| `/forgot-password` | Password-reset request | Public | token/mail services | Pending |
| `/reset-password/[token]` | Password reset completion | Valid token | token service, Prisma | Pending |
| `/invite/[token]` | Invitation activation | Valid invite | invites, Auth.js | Pending |
| `/maintenance` | Maintenance-state landing | Public/redirected | feature flag/settings | Pending |
| `/dashboard` | Role dispatch | Authenticated | live role grants | Pending |
| `/dashboard/mentor` | Mentor overview | Mentor | pairings, goals, meetings, journey | Pending |
| `/dashboard/mentee` | Mentee overview | Mentee | pairing, goals, meetings, journey | Pending |
| `/profile` | Current-user profile | Authenticated | mentor/mentee profile, avatar API | Pending |
| `/pair` | Pair workspace resolver | Mentor or Mentee | accepted matches | Pending |
| `/pair/[menteeId]` | Pair workspace | Related Mentor/Mentee | agreements, goals, sessions, messages | Pending |
| `/agreements` | Agreement signing/download | Related Mentor/Mentee | agreements, private PDF API | Pending |
| `/goals` | Goal create/review lifecycle | Mentor or Mentee | goals, reviews, evidence | Pending |
| `/sessions` | Session logs and actions | Mentor or Mentee | sessions, AI session assistant | Pending |
| `/meetings` | Meeting lifecycle | Mentor or Mentee | meetings, calendar provider seam | Pending |
| `/meetings/[id]/prepare` | AI-assisted meeting preparation | Meeting participant | meeting data, AI cache | Pending |
| `/calendar` | Programme calendar | Authenticated | meetings/training/reviews | Pending |
| `/messages` | Conversation list/workspace | Conversation participant | Prisma, Supabase Realtime | Pending |
| `/messages/[conversationId]` | Direct message thread | Conversation participant | messages, reads, Realtime | Pending |
| `/journal` | Reflections/private mentor notes | Mentor or Mentee | reflections/private notes | Pending |
| `/mid-term-review` | Mid-term response | Mentor or Mentee | form definition/response | Pending |
| `/final-review` | Final response | Mentor or Mentee | form definition/response | Pending |
| `/certificate` | Owner-scoped certificate | Mentor or Mentee | match, completion evidence, PDF API | Pending |
| `/notifications` | User notifications/preferences | Authenticated | notifications | Pending |
| `/support` | Participant support request | Authenticated | support requests | Pending |
| `/help` | Help index | Authenticated | localized articles | Pending |
| `/help/[slug]` | Help article | Authenticated | localized article | Pending |
| `/admin` | Programme operations dashboard | Super Admin | aggregate programme data | Pending |
| `/admin/programmes` | Programme management | Super Admin | programmes actions | Pending |
| `/admin/programmes/[id]/edit` | Programme editor | Super Admin | programmes actions | Pending |
| `/admin/cohorts` | Cohort management | Super Admin | cohorts actions | Pending |
| `/admin/cohorts/[id]/edit` | Cohort editor | Super Admin | cohorts actions | Pending |
| `/admin/imports` | Import upload/validation | Super Admin | imports, private storage | Pending |
| `/admin/imports/[id]` | Import review/commit | Super Admin | import rows/actions | Pending |
| `/admin/matching` | Matching recommendations/approval | Super Admin | matching engine/actions | Pending |
| `/admin/mentors` | Mentor directory | Super Admin | mentor profiles | Pending |
| `/admin/mentors/[id]` | Mentor detail | Super Admin | scoped participant data | Pending |
| `/admin/mentees` | Mentee directory | Super Admin | mentee profiles | Pending |
| `/admin/mentees/[id]` | Mentee detail | Super Admin | scoped participant data | Pending |
| `/admin/invites` | Invitation management | Super Admin | invite/mail service | Pending |
| `/admin/training` | Training overview | Super Admin | profiles/training status | Pending |
| `/admin/forms` | Review form definitions | Super Admin | form definitions | Pending |
| `/admin/forms/new` | Form builder | Super Admin | forms actions | Pending |
| `/admin/forms/[id]/edit` | Form editor | Super Admin | forms actions | Pending |
| `/admin/goals` | Programme goal overview | Super Admin | scoped goals | Pending |
| `/admin/meetings` | Programme meeting overview | Super Admin | scoped meetings | Pending |
| `/admin/sessions` | Programme session metadata | Super Admin | scoped session logs | Pending |
| `/admin/insights` | Risk/analytics/AI report | Super Admin | aggregates, AI assistant | Pending |
| `/admin/support` | Support queue | Super Admin | support actions | Pending |
| `/admin/settings` | Maintenance/platform settings | Super Admin | settings actions | Pending |
| `/api/auth/[...nextauth]` | Auth.js handler | Public/authenticated | Auth.js providers | Pending |
| `/api/health` | Sanitized health check | Public/API | runtime dependencies | Pending |
| `/api/avatar/[id]` | Protected avatar stream | Authorized viewer | private storage | Pending |
| `/api/agreements/[id]/pdf` | Protected agreement PDF | Signer or Super Admin | private storage | Pending |
| `/api/goals/evidence/[id]` | Protected goal evidence | Related participant/admin | private storage | Pending |
| `/api/cron/notifications` | Daily notification scheduler | Cron secret | notification/mail services | Pending |

## Route-group boundaries

- Root: global layout, loading, error, and not-found boundaries.
- Public pages: public layout/loading boundary.
- Authentication: auth layout/loading boundary.
- Participant dashboard: authenticated layout/loading/error boundary plus dedicated loading/error boundaries on high-risk routes such as messages and pair.
- Administrator: authenticated admin layout/loading boundary and leaf loading boundaries for every major list.
