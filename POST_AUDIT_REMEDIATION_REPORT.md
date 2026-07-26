# BLAK MOH Post-Audit Remediation Report

**Date:** 2026-07-26
**Remediation status:** `CODE_COMPLETE_WITH_OWNER_ACTIONS`
**Features removed:** 0
**Routes removed:** 0
**Public routes added:** 3

## Executive outcome

Every concern from the full-platform audit was reopened against the original reports, test matrix, defect log, route inventory, evidence, and current source. Every safe code-level repair has been implemented. The remaining work requires owner-controlled database migration, Microsoft/provider credentials and consent, isolated staging infrastructure, production telemetry, or legal approval; those items are separated in `OWNER_ACTIONS_REQUIRED.md`.

The remediation preserves mentor, mentee, administrator, and Super Admin workflows; authentication and authorization; English and French; certificates; matching; messages; goals; meetings; sessions; reviews; support; imports; notifications; and AI features.

## Concerns received and disposition

| Concern | Root cause | Remediation | Current status |
|---|---|---|---|
| Microsoft Graph and Entra absent | Production tenant values/consent were unavailable; integrations shared legacy naming | Independent Entra, Graph mail, and Graph calendar configuration/health, sanitized diagnostics, timeouts, calendar idempotency, admin readiness UI, exact owner checklist | Code complete; tenant configuration blocked on owner |
| Three public 404 routes | Paths were declared public but no App Router pages existed | Added bilingual `/programme`, `/mentor-guide`, `/mentee-guide`, metadata, responsive layout, nav/footer links, direct/refresh/EN/FR browser checks | Fixed |
| Oversized server-action uploads | File bytes crossed Vercel functions despite 5/10 MB application limits and unlimited imports | Authenticated one-time signed uploads to private Supabase Storage, confirm-by-reference, byte/signature validation, collision-safe scoped paths, DB write after success, 20 MB import cap, safe legacy fallback | Code fixed; staging boundary upload and lifecycle validation owner-gated |
| Residual admin localization | Matching and import-detail presentation copy bypassed message catalogues | Moved residual headings, labels, status values, insights, plurals, actions, and integration-health copy into reviewed EN/FR resources | Fixed |
| Messaging and Realtime hardening | Racy conversation provisioning, guessable public nudge topics, no write throttle, weak reconnect/send recovery | Unique direct conversation key + migration, atomic upsert, parallel provisioning, opaque HMAC topic, per-user send throttles, rollback/retry UI, polling/visibility/online reconciliation, cleanup, server authorization retained | Code fixed; migration and staged reconnect/multi-tab validation owner-gated |
| Capacity not validated in staging | Only anonymous local traffic was safe to run; provider plans/telemetry unavailable | Removed provisioning waterfall, bounded message writes, bounded/timed AI requests, Realtime refresh control, direct uploads, chart sizing repair, safe local rerun | Partially fixed; qualified staging test still required |
| 20 lint warnings | Controlled resets, hydration/local state, animation and ref writes triggered React compiler rules | Reworked state initialization, deferred external hydration, removed render-time ref writes and unnecessary mount/route effects, derived search state | Fixed: 0 errors, 0 warnings |

## Public routes

Added:

- `/programme`
- `/mentor-guide`
- `/mentee-guide`

Each route is a real public page rather than a placeholder. Content is derived from already approved programme behavior in the repository; no legal claims or invented organisational promises were added. All three have English/French message resources and metadata, responsive layouts, current-route navigation, footer entry points, and confidentiality/support pathways.

Verification:

- Production-mode direct requests: HTTP <400
- English and French headings: pass
- Browser refresh: pass
- No redirect loop: pass
- Public access policy: pass
- 320–1920px overflow matrix on the public shell: pass
- Evidence: `full-platform-evidence/browser/public-*-guide-desktop.png`

## Upload architecture

### Profile photographs

- Client validates selection and requests an authorized one-time target.
- Target path is `avatars/<authenticated-user>/<random UUID>.<ext>`.
- Client uploads directly to the private bucket.
- Confirmation re-authenticates, checks path ownership, exact byte count, MIME/extension, and file signature before updating `User.image`.
- Invalid content is removed; no user record is changed before confirmation.

### Goal evidence

- Target is scoped to cohort and owned goal.
- Prepare and confirm both re-check user ownership and allowed goal stage.
- Confirmation verifies path scope, byte count, MIME/extension, signature, and writes exactly one evidence row only after storage success.
- Private download authorization remains unchanged.

### CSV/Excel imports

- Maximum is now an explicit 20 MB.
- Direct target is scoped to cohort and administrator.
- Server downloads the private object by reference, verifies CSV/XLS/XLSX/XLSM signatures, parses/validates, then creates the import record.
- Successful temporary imports are removed after processing; invalid uploads are removed.

Interrupted uploads surface retryable errors and do not create database records. Browser/network cancellation stops the client request; provider-level lifecycle cleanup for a request that reached storage but never confirmed is an owner storage-policy action.

## Administrator localization

The matching and import-detail surfaces now use the existing `next-intl` architecture for:

- matching strength, confidence, language compatibility, rationale, queue, and rank;
- import breadcrumb, review subtitle, records/table headings, roles, statuses, validation pluralization, system health, insights, CSV/report actions;
- Microsoft integration health names, descriptions, statuses, and missing-variable labels.

English/French catalogue key parity passes. A focused production-browser assertion also passes on the French matching, imports, and Microsoft integration settings pages. Dates continue through locale-aware formatters. No language workflow was removed.

## Messaging and Supabase Realtime

- Added nullable unique `Conversation.directKey` and a migration that backfills the oldest valid two-party conversation per cohort/pair without deleting historical records.
- Conversation provisioning now uses a stable order-independent key and Prisma `upsert`, eliminating the concurrent first-open duplicate race.
- Pair provisioning runs independently in parallel instead of as a sequential query waterfall.
- Realtime topics use HMAC-SHA256 over the conversation ID; raw IDs are not exposed as guessable channel names.
- Missing Realtime configuration degrades to authenticated polling rather than crashing.
- Subscription cleanup still removes the exact channel on route change/unmount.
- Subscription, online, and tab-visibility recovery reconcile through authorized server reads.
- Failed optimistic sends roll back, restore the draft, show a retryable state, and never require a page reload.
- Message writes are limited to 8 per 10 seconds and 30 per minute per authenticated user using shared Upstash state when configured.
- All reads and writes retain participant checks; admins still cannot read message content.

Focused tests cover direct-key stability, legacy backfill, atomic upsert, infrastructure errors, and opaque topics. Hosted browser message tests are not run until the owner applies the pending migration.

## Microsoft Entra and Graph readiness

- Entra SSO, Graph mail, and Graph calendar have independent health groups and variable names.
- Legacy `MAIL_GRAPH_*` names remain accepted only when actually configured.
- Fully disabled integrations report the new documented names.
- Missing/partial configuration is visible to Super Admins without displaying values.
- Node startup logs only mode and missing variable names.
- Production base infrastructure validation no longer crashes the whole portal merely because an optional Microsoft integration is disabled.
- Token acquisition is cached per tenant/client and bounded by a 10-second timeout.
- Mail is bounded by a 15-second timeout and is not retried after an ambiguous send.
- Calendar requests use a stable `transactionId`, a 15-second timeout, and at most one retry for explicit 429/503 responses.
- User-visible flows continue to fail gracefully without raw provider responses or secrets.

Exact variables, permissions, consent, redirect URIs, mailbox scoping, redeployment, and verification are in `OWNER_ACTIONS_REQUIRED.md`.

## Capacity improvements and rerun

Software bottlenecks addressed:

- atomic/parallel direct-conversation provisioning;
- shared message write throttles;
- 15-second authenticated message reconciliation instead of refresh-per-nudge only;
- per-process AI concurrency bound (default 4);
- AI provider abort timeout (default 20 seconds);
- Graph token/mail/calendar timeouts and idempotency;
- direct-to-storage upload paths;
- Recharts positive initial dimension without narrow-card overflow;
- removal of avoidable React effect/ref warnings.

Safe local production rerun:

| VUs | Error rate | p50 | p95 | p99 | Result |
|---:|---:|---:|---:|---:|---|
| 5 | 0% | 356 ms | 794 ms | 2,055 ms | Pass |
| 10 | 0% | 585 ms | 832 ms | 911 ms | Pass |
| 25 | 0% | 1,508 ms | 2,238 ms | 2,401 ms | Stop: p95 threshold breached |

Health was `db=up` before and after. The harness did not attempt 50/100 after the threshold breach. The earlier same-day audit reached 50 VUs within thresholds, demonstrating material local-host variance; the conservative current release evidence is therefore **10 local anonymous public VUs within thresholds**, not an invented production capacity. Authenticated/Realtime/provider capacity remains staging-only.

## Defects closed

- `AUD-ROUTE-001`
- `AUD-UPLOAD-001` (code; staging boundary verification pending)
- `AUD-MSG-001`
- `AUD-RT-001` (code; migration/staging verification pending)
- `AUD-I18N-002`
- `AUD-CHART-001`
- `AUD-DEV-001`
- `AUD-AUTHLOG-001`
- Application portion of `AUD-AI-001`
- Application readiness portion of `AUD-ENV-001`

## Verification summary

| Check | Result |
|---|---|
| Production build | PASS; all routes emitted, including the three restored public routes |
| TypeScript | PASS |
| Lint | PASS; 0 errors, 0 warnings |
| Unit/integration | PASS; 39 files, 315 tests |
| Prisma schema | PASS |
| Public production browser | PASS; EN/FR and three restored routes |
| Admin route browser | PASS; 17 workspaces plus focused French matching/imports/settings assertions |
| Certificate production browser | PASS; 4 authorization, ownership, mobile and PDF checks |
| Mobile shell | PASS at 390×844 |
| Viewport matrix | PASS at 320, 375, 390, 768, 1024, 1280, 1440, 1920 |
| Invalid login | PASS; generic UI and no expected-error stack |
| Chart regression | Initial 600px sentinel failed by 81px; corrected to 1px and admin sweep rerun PASS |
| Safe load | PASS through 10 VUs; automatic stop at 25 p95 breach |
| Full hosted messages/reconnect | BLOCKED until migration is applied in isolated staging |
| Real Graph/Entra/provider delivery | BLOCKED by owner credentials/consent and no-real-send rule |

The repository Prettier check is not a release gate here: `prettier-plugin-tailwindcss` attempts to load missing Tailwind v4 `node_modules/tailwindcss/theme.css` in this Tailwind v3 project. This unrelated toolchain issue was not hidden or used to replace lint/typecheck.

## Remaining blockers

Only owner/infrastructure items remain:

- apply the direct-conversation migration before deployment;
- configure/consent Microsoft Graph mail and, if required, calendar and Entra SSO;
- confirm private storage limits/lifecycle policy;
- provision isolated staging and authorize authenticated/Realtime/upload/load testing;
- validate AI keys/models/quotas;
- approve certificate legal identity;
- obtain formal accessibility certification if required.

See `OWNER_ACTIONS_REQUIRED.md` for exact values, locations, permissions, cost/admin requirements, consequences, and verification procedures.
