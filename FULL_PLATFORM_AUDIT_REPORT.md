# BLAK MOH Full Platform Audit Report

**Final audit status:** `CODE_COMPLETE_WITH_OWNER_ACTIONS`
**Date:** 2026-07-26
**Scope:** certificate redesign, current repository/build, public experience, Auth.js/RBAC, mentor, mentee, Super Admin, APIs/storage, localization, responsive/accessibility smoke, performance and safe capacity assessment.

## Executive summary

The full safe code remediation is complete. The current workspace builds successfully, passes TypeScript, has zero lint errors or warnings, and passes the complete unit/integration suite. Production-mode and development browser sweeps cover the public EN/FR experience, all 17 static admin workspaces, participant shells, certificate access, required viewport widths, and the restored guide routes without a route crash, 5xx, global error screen or horizontal overflow.

The redesigned certificate experience is complete: participant self-service, cohort-scoped admin management, exact completion eligibility, stable non-enumerable IDs, reviewed English/French copy, premium official-brand preview and a private vector PDF route. Authorization, direct URL, ineligible, mobile, desktop and PDF evidence passed.

No P0 security issue was found. Server-side RBAC, cohort scoping, message confidentiality, journal/private-note separation and protected files remain intact. The three declared guide routes now exist bilingually; large files use signed direct-to-private-storage paths; affected admin copy is localized; message provisioning, recovery, opaque topics and throttles are hardened; AI and Graph calls are bounded; and all 20 lint warnings are closed. No feature or route was removed.

Capacity remains measured only for anonymous local production traffic. The remediation rerun passed **10 VUs** within thresholds and stopped automatically when **25 VUs** breached p95; an earlier same-day run reached 50 VUs, showing significant local-host variance. The defensible current figure is therefore 10 local anonymous public VUs—not a production user limit—until isolated staging tests include database, Realtime, authenticated, upload, AI and provider telemetry.

## Condition and release recommendation

| Area | Condition | Recommendation |
|---|---|---|
| Build/tests | Green | Code-level release gate passed |
| Certificate | Complete and verified | Ready after owner approves formal wording/signatory titles |
| Authorization/privacy | Strong | Apply the direct-conversation migration before deploying this code |
| Public/participant/admin navigation | Stable | Three declared public guide routes restored and verified EN/FR |
| Localization | Affected participant/admin surfaces localized | Owner-managed form-question data still requires bilingual content governance |
| External integrations | Partially configured | P1 owner action for Graph mail/calendar/Entra |
| Files | Private/scoped signed direct upload implemented | Verify size boundaries and lifecycle policy in isolated staging |
| Accessibility | Manual/role-selector smoke and viewport automation | Formal axe/pa11y + contrast/200% zoom audit still required |
| Performance/capacity | Public local measurement only | Do not infer production capacity; run staging DB/Realtime/AI load tests |

**Release recommendation:** the source is `CODE_COMPLETE_WITH_OWNER_ACTIONS`. Do not deploy the messaging changes until the pending migration is applied, and do not market password-reset/invite email, Outlook sync or enterprise SSO as operational until owner configuration is supplied and verified. Do not derive a production concurrency promise from the anonymous local load run.

## Verification totals

- Production build: pass; all application/API routes emitted, including the three restored public routes.
- TypeScript: pass.
- ESLint: 0 errors, 0 warnings.
- Vitest: 39 files, 315 tests passed; none failed or skipped.
- Certificate E2E: 4 tests passed (admin, mobile, participant ownership, unrelated access).
- Full-route browser audit: public EN/FR set, 17 static admin routes, focused French admin surfaces, participant sets, certificate authorization/PDF and isolated mobile regression passed.
- Safe public capacity rerun: 5/10 VU stages pass; 25 VU p95 breach triggers automatic stop; higher stages intentionally not attempted.

The detailed status and blocked cases are in `FULL_PLATFORM_TEST_MATRIX.md`.

## Certificate redesign status

Completed deliverables:

- Official repository logo and BLAK MOH green/forest/ivory/gold design system.
- Desktop and mobile preview, participant/programme/cohort context, language selection, status, generate/regenerate, print and download controls.
- English and French certificates with reviewed wording, accents and long-name fitting.
- A4 landscape vector PDF using `pdf-lib`; no fake signature, seal or QR mechanism.
- Stable certificate ID derived from match, recipient role and programme year using SHA-256; no raw match ID or participant information exposed.
- Eligibility requires training completion, an approved/completed goal, and submitted role-matched mid-term and final reviews.
- Owner self-access and cohort-scoped Super Admin access; ineligible official issuance returns 409 and unrelated access returns 404.

No live seeded participant was fully eligible, so official issuance gating was tested against real current data and visual PDF rendering used generated safe eligible data. No issuance-history table was invented. Legal wording, signatory names/titles and an official seal remain owner decisions. See `CERTIFICATE_REDESIGN_REPORT.md`.

## Passed critical workflows and controls

### Public and authentication

- Implemented public pages, login and signup render without error; public security headers and health endpoint pass existing E2E checks.
- Unauthenticated protected access redirects to login; role dispatch lands users correctly.
- Credentials errors are generic; login is shared-rate-limited in production through Upstash.
- JWT sessions carry roles but every protected data access re-reads the active user and grants, reducing stale-role risk.
- Maintenance mode preserves Super Admin access; production toggle was not changed.

### Mentee and mentor

- Dashboards, profile, pair, goals, sessions, messages, meetings, calendar, journal, agreements, reviews, notifications, support, help and certificate routes render for the correct role.
- `/pair` and `/messages` no longer use the redirect/prefetch pattern that caused intermittent soft-navigation failures; current browser sweeps completed without repeat reload.
- Existing lifecycle evidence and current tests cover goal feedback, meeting/session workflows, notifications, agreements, review forms and journey logic.
- Mentor access is scoped to accepted related mentees; mentees cannot access another pair.

### Super Admin

- Dashboard, programmes, cohorts, imports, matching, directories, invites, training, forms, goals, meetings, sessions, insights, support, settings and certificate management all render.
- Matching language is a server-side hard rule and cannot be bypassed by manual override.
- Admin session views intentionally exclude mentor private notes and direct-message content.
- Cohort date validation, signature-name validation and prior dashboard metric defects are repaired in the current source.

### Privacy/security

- Direct-message reads and writes require conversation participation; administrators see metadata only.
- Journal reflections and mentor private notes use visibility/ownership predicates; private notes are excluded from admin aggregates.
- Agreement PDFs, goal evidence, avatars and certificate PDFs are private handlers with explicit authorization.
- Storage object keys remain server-side; uploads use generated paths rather than user filenames.
- No persistent cross-user `unstable_cache` was found around sensitive data. React `cache()` use is request-scoped; logout uses Auth.js session invalidation.
- AI actions are server-side, bounded-input, advisory and do not automatically save destructive output.

## Post-remediation issue status

### P0

None found.

### P1 owner/infrastructure blocker

1. **AUD-ENV-001:** application readiness is complete, but Microsoft Graph mail/calendar and Entra configuration, consent and mailbox policy are owner-controlled. Password-reset/invite delivery, Outlook integration and enterprise SSO are not production-operational until configured and verified.

### P2 status

- **AUD-ROUTE-001 — fixed:** `/programme`, `/mentor-guide`, `/mentee-guide` now render in EN/FR.
- **AUD-UPLOAD-001 — fixed in code:** signed direct-to-private-storage uploads bypass the function-body ceiling; staging size-boundary/lifecycle verification remains owner-gated.
- **AUD-AI-001 — application fixed/provider blocked:** per-process concurrency and abort timeouts are implemented; valid provider credentials/quotas require owner verification.
- **AUD-MSG-001 — fixed:** shared per-user write throttles are enforced before message writes.
- **AUD-RT-001 — fixed in code/deployment gated:** HMAC topics, atomic provisioning and recovery are implemented; the migration must be applied before deployment and multi-tab/Realtime load remains staging-only.
- **AUD-I18N-002 — fixed:** matching, import-detail and integration-health UI copy is localized. Owner-managed form-definition question data remains a content-governance concern, not an open source defect.

### P3 status

- **AUD-CHART-001 — fixed:** positive chart initialization no longer produces negative-size warnings or narrow-card overflow.
- **AUD-DEV-001 — fixed:** lint is clean with zero errors and zero warnings.
- **AUD-AUTHLOG-001 — fixed:** expected credential rejection uses a concise structured event while unexpected errors remain reportable.

### Fixed during this audit

- Certificate authorization/eligibility/ID/PDF/management redesign (P1 baseline gap).
- Messages mixed-language labels (P2).
- Stale private avatar broken-image fallback (P2).
- Mentee dashboard 390 px overflow (P2).
- PDF rotation API/type errors found by the deploy build (build blocker).
- All post-audit P2/P3 code fixes listed above.

See `FULL_PLATFORM_DEFECT_LOG.md` for reproducible fields, causes, files and evidence.

## Not implemented (not reported as working)

- Separate Programme Admin, Trainer and Reviewer roles; code explicitly folds them into `SUPER_ADMIN`.
- Dedicated user-management, role-management and audit-log routes.
- Full community forum, newsletter management and clinic-management workflows described in roadmap documents.
- A public certificate verification/QR route and persisted issuance ledger.
- A complete AI programme-report workflow beyond current assistants/insights seams.

## Blocked or deliberately not executed

- Real password-reset/invite mail, external notifications, Outlook events and SSO tenant login.
- Maintenance-mode activation in production.
- Destructive import commits, match reassignment, mass invitations or data cleanup.
- Heavy production database, Realtime, login, messaging, upload or AI load tests.
- Current-provider AI success because credentials/quotas are owner-controlled.
- Formal automated WCAG 2.2 AA scan (axe/pa11y not installed), screen-reader lab pass and physical 200% zoom/contrast certification.
- Provider plan, CPU/RAM and historical pool/quota telemetry unavailable from repository/CLI access.

## Localization findings

Translation files have key parity and participant navigation, certificate and message workspace pass in French, including `html lang="fr"`. Formal certificate wording was manually reviewed and does not mix languages. Active UI locale is used for agreements/reviews instead of only saved account locale.

Affected hardcoded admin fragments are now translated and the EN/FR catalogues have key parity. Remaining French risk is owner-managed question content already stored in form definitions; that requires governed content/data review rather than automatic source-code translation.

## Accessibility and responsive findings

The app has semantic headings, role-queryable controls, named navigation, keyboard-addressable actions, visible focus utilities, reduced-motion handling and responsive route layouts. Browser tests exercised role selectors and document overflow. The found mentee mobile overflow is fixed.

Automated viewport coverage targets 320, 375, 390, 768, 1024, 1280, 1440 and 1920 widths. A formal axe/pa11y audit, measured colour-contrast inventory, screen-reader pass and 200% zoom lab remain blocked and should precede an unconditional WCAG 2.2 AA claim.

## Performance findings

- Production build and route collection pass.
- Vercel and Supabase are Frankfurt-aligned (`fra1` / `eu-central-1`).
- Public 3D components live under the landing route and are not imported by the authenticated shell.
- Shell navigation is client-persistent and data reads commonly use `Promise.all`/request caching; actions explicitly revalidate affected routes.
- Recharts startup warnings and the introduced narrow-card regression are fixed; the prior 68.88 MB observed function output still deserves deployment monitoring.
- The certificate admin candidate lookup is acceptable at current scale but should be profiled for N+1 behavior with large cohorts.

## Capacity findings

The database snapshot reports PostgreSQL 17.6, `max_connections=60`, 21 total observed connections and 18.6 MB database size. The pool hostname shows Supavisor and official limits indicate 60 direct connections is consistent with Nano/Micro defaults, but plan/compute cannot be inferred or assumed.

The latest measured local public rerun passes 10 VUs within thresholds and breaches p95 at 25 VUs, where the harness stops. An earlier same-day run reached 50 VUs, so the reports explicitly treat this as variable local evidence rather than a production capacity claim. Limitations and required staging measurements are in `CAPACITY_AND_LOAD_TEST_REPORT.md`.

Official constraint references: [Vercel Functions limits](https://vercel.com/docs/functions/limitations), [Supabase connection management](https://supabase.com/docs/guides/database/connection-management), [Supabase Realtime reports](https://supabase.com/docs/guides/realtime/reports).

## Required owner decisions before broader launch

1. Supply and verify Microsoft Graph/Entra tenant configuration, sender policy and calendar permissions—or explicitly remove those capabilities from launch claims (no route/feature was removed here).
2. Approve certificate legal wording, signatory titles/names and official seal asset.
3. Apply migration `20260726120000_harden_direct_conversations` before deploying the remediated messaging code.
4. Confirm private storage, direct-upload size boundaries and abandoned-object lifecycle policy.
5. Confirm Vercel/Supabase plans, Realtime/Storage quotas, AI account limits and alert thresholds.
6. Commission an isolated staging load test and formal WCAG audit before scaling beyond the controlled pilot.

## Deliverables

- `PLATFORM_AUDIT_MASTER_SPEC.md`, `PLATFORM_AUDIT_TODO.md`, `PLATFORM_ROUTE_INVENTORY.md`
- `CERTIFICATE_REDESIGN_REPORT.md`, `certificate-evidence/`
- `FULL_PLATFORM_AUDIT_REPORT.md`
- `POST_AUDIT_REMEDIATION_REPORT.md`, `OWNER_ACTIONS_REQUIRED.md`
- `FULL_PLATFORM_TEST_MATRIX.md`
- `FULL_PLATFORM_DEFECT_LOG.md`
- `FULL_PLATFORM_ROUTE_INVENTORY.md`
- `CAPACITY_AND_LOAD_TEST_REPORT.md`, `load-tests/`, `capacity-evidence/`
- `full-platform-evidence/`
