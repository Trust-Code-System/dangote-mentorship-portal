# QA Route & Feature Inventory — BLAK MOH Mentorship Portal

- **Environment audited:** Production (`https://dangote-mentorship-portal.vercel.app`) + local source (`main` @ 290842d)
- **Date:** 2026-07-24
- **Auditor session:** Super Admin (in-app browser)
- **Source of truth:** `src/app/**` routes, `src/proxy.ts` (route gate), `src/lib/nav/sections.ts` (nav), `src/features/**` (actions/data)

## Roles — IMPORTANT correction to the brief
The brief names six roles (Super Admin, Programme Admin, Mentor, Mentee, Trainer, Reviewer). **The code implements only three:** `SUPER_ADMIN`, `MENTOR`, `MENTEE` (`src/lib/auth/roles.ts:7` — "the former Programme Admin, Trainer, and Reviewer roles were folded into Super Admin"). Therefore:
- Phases that ask to test **Trainer** and **Reviewer** as distinct roles are **Not Applicable** (by design), not defects.
- "Administrator" and "Super Admin" are the same role here; there is no separate lesser-admin.

## Route gate
`src/proxy.ts` (Next 16 renamed `middleware` → `proxy`) runs `authConfig.authorized`:
- Public paths: `/`, `/login`, `/signup`, `/invite/*`, `/forgot-password`, `/reset-password/*`, `/about`, `/faq`, `/programme`, `/mentor-guide`, `/mentee-guide`, `/maintenance`, `/api/auth/*`, (`/design` only when NODE_ENV≠production).
- Any other path requires a session; `/admin/*` additionally requires `SUPER_ADMIN`.
- `matcher` excludes `/api` — **API routes are NOT gated by the proxy** and must (and do) enforce auth in-handler.

## Legend — Tested column
`✅ tested` · `🟡 partial` · `⛔ blocked (needs role login)` · `📖 code-review only` · `— not yet`

---

## Public routes
| Route | Role | Purpose | Backing | Tested | Notes / Defect |
|---|---|---|---|---|---|
| `/` (`(public)/page.tsx`) | anon | Marketing homepage | static | ⛔ (logged-in redirects to dashboard) | Need logout pass |
| `/about` | anon | About programme | static | — | |
| `/faq` | anon | FAQ | static | — | |
| `/design` | anon (non-prod only) | Design-system gallery | static | n/a in prod | Correctly gated off in prod |
| `/login` | anon | Credentials + Entra SSO | `(auth)/login/actions.ts` | ✅ (login confirmed working post-fix) | |
| `/signup` | anon | Self sign-up | `(auth)/signup` | — | |
| `/invite/[token]` | anon | Accept invite | `invite/[token]/actions.ts` | — | |
| `/forgot-password` | anon | Request reset | `reset-password` actions | — | Avoid excess emails |
| `/reset-password/[token]` | anon | Reset via token | `(auth)/reset-password/[token]/actions.ts` | — | |
| `/maintenance` | any | Maintenance holding page | `settings/maintenance.ts` | — | Test carefully; don't leave prod in maint. |

## Participant routes (MENTOR / MENTEE)
| Route | Role | Purpose | Backing | Tested | Notes |
|---|---|---|---|---|---|
| `/dashboard` | any auth | Role router → mentor/mentee/admin home | `defaultDashboardPath` | 🟡 (redirects observed) | |
| `/dashboard/mentor` | MENTOR | Mentor home | `features/dashboard/data` | ⛔ | Needs mentor login |
| `/dashboard/mentee` | MENTEE | Mentee home | `features/dashboard/data` | ⛔ | Needs mentee login |
| `/profile` | any auth | Profile view/edit + avatar | `features/profiles/actions.ts` | ⛔ | Needs role login |
| `/pair` | MENTOR/MENTEE | Pair workspace (own) | `features/pair/data.ts` + `access.ts` | 📖 (access rule reviewed) | |
| `/pair/[menteeId]` | MENTOR | Specific mentee workspace | `features/pair` | ⛔ | |
| `/goals` | MENTOR/MENTEE | Goals + AI Goal Coach | `features/goals/*` | ⛔ | |
| `/sessions` | MENTOR/MENTEE | Session logs + AI summary | `features/sessions/*` | ⛔ | |
| `/messages`, `/messages/[conversationId]` | MENTOR/MENTEE | Direct messages | `features/messages/*` | 📖 (privacy reviewed, IDOR-safe) | |
| `/meetings`, `/meetings/[id]/prepare` | MENTOR/MENTEE | Scheduling + prep | `features/meetings/*` | ⛔ | |
| `/calendar` | MENTOR/MENTEE | Calendar views | `features/calendar/*` | ⛔ | |
| `/journal` | MENTEE (+mentor notes) | Reflection journal | `features/reflections/*` | 📖 (visibility reviewed) | |
| `/agreements` | MENTOR/MENTEE | Mentoring + confidentiality e-sign | `features/agreements/*` | ⛔ | |
| `/mid-term-review`, `/final-review` | MENTOR/MENTEE | Review forms | `features/reviews/*` | ⛔ | |
| `/notifications` | any auth | Notification inbox | `lib/notifications/*` | ⛔ | |
| `/support` | MENTOR/MENTEE | Raise support request | `features/support/*` | ⛔ | |
| `/help`, `/help/[slug]` | any auth | Help articles | `features/help/articles.ts` | — | |

## Admin routes (SUPER_ADMIN)
| Route | Purpose | Backing | Tested | Notes / Defect |
|---|---|---|---|---|
| `/admin` | Enterprise Health Dashboard | `features/dashboard/data`, `risk`, `matching/timeline` | ✅ | **QA-ADMIN-001/002** (tile bugs) |
| `/admin/matching` | Matching engine review/approve/override | `features/matching/*` | ✅ | **QA-MATCH-003** (no run feedback) |
| `/admin/insights` | Programme insights/charts | `features/admin/insights-data.ts` | — | |
| `/admin/programmes`, `/[id]/edit` | Programme CRUD | `features/programmes/*` | — | |
| `/admin/cohorts`, `/[id]/edit` | Cohort CRUD | `features/cohorts/*` | — | |
| `/admin/imports`, `/[id]` | CSV/XLSX import + validation | `features/imports/*` | — | |
| `/admin/forms`, `/new`, `/[id]/edit` | Forms builder | `features/forms/*` | — | |
| `/admin/goals` | Programme goals list | `features/admin/overview-data.ts` | — | |
| `/admin/sessions` | Read-only session logs (no private notes) | `overview-data.ts:getProgrammeSessionLogs` | 📖 (excludes mentorNotes ✓) | |
| `/admin/meetings` | Upcoming meetings list | `overview-data.ts` | — | |
| `/admin/training` | Training completion | `overview-data.ts:getTrainingOverview` | — | |
| `/admin/mentors`, `/[id]` | Mentor directory + detail | `features/profiles/detail.ts` | — | |
| `/admin/mentees`, `/[id]` | Mentee directory + detail | `features/profiles/detail.ts` | — | |
| `/admin/invites` | Create/revoke invites | `features/invites/*` | — | Don't email real users |
| `/admin/support` | Support queue | `features/support/queue.ts` | — | |
| `/admin/settings` | Platform settings + maintenance mode | `features/settings/*` | — | Super-Admin only ✓ |

## API routes (self-authorized, outside proxy)
| Route | Auth model | Tested | Notes |
|---|---|---|---|
| `/api/auth/[...nextauth]` | Auth.js | ✅ (login) | |
| `/api/avatar/[id]` | any authenticated viewer | 📖 IDOR-safe | 401 if anon |
| `/api/agreements/[id]/pdf` | signer/participant | — | Review pending |
| `/api/goals/evidence/[id]` | uploader OR admin OR paired mentor | 📖 IDOR-safe | `attachment`, `no-store` ✓ |
| `/api/cron/notifications` | `Bearer CRON_SECRET` | — | 503 when unset |
| `/api/health` | public | — | |

## AI assistants (all server-side, advisory, human-gated)
Atlas copilot (`features/copilot/actions.ts` — advisory only, never reads private content), Goal Coach (`goals/coach.ts`), Session assistant (`sessions/assistant.ts`), Review assistant (`reviews/assistant.ts`), Icebreaker (`icebreaker/*`), Next-action (`next-action/*`), Translation (`translation/*`), Matching rationale (engine). All gated behind `getAiAdapter()` (`lib/ai`) with Anthropic→OpenAI fallback; features degrade when keys unset. **Tested:** — (needs live AI key + role sessions).

## Environment-dependent features
- **DB:** `DATABASE_URL`/`DIRECT_URL` must carry `?schema=mentorship` (root cause of the earlier Vercel login failure — now fixed).
- **AI:** `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — AI features hide/degrade when unset.
- **Mail:** `MAIL_GRAPH_*` — falls back to log transport.
- **Storage:** Supabase (`SUPABASE_SECRET_KEY` + bucket) else local.
- **Rate limit:** `UPSTASH_REDIS_*` — else in-memory (ineffective across serverless instances — see report).
- **Cron:** `CRON_SECRET` — notifications/digest.
- **SSO:** `AUTH_MICROSOFT_ENTRA_ID_*` — SSO button + provider gated on full config.
