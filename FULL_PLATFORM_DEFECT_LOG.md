# Full Platform Defect Log

Severity: P0 critical · P1 high · P2 medium · P3 low. `Fixed` means rerun evidence exists in this workspace. Historical production observations are explicitly labelled.

## Post-remediation status (2026-07-26)

All source-fixable findings below are closed or code-complete. `AUD-ENV-001` and provider validation in `AUD-AI-001` remain owner-blocked; the Realtime/database portion of `AUD-RT-001` requires the pending migration and isolated staging. Historical reproduction text is retained for traceability.

## AUD-CERT-001 — Certificate completion and authorization were incomplete

- **Severity / feature:** P1 / certificates
- **Roles / URL:** Mentor, Mentee, Super Admin / `/certificate`, `/admin/certificates`, `/api/certificates/[matchId]/pdf`
- **Preconditions:** Existing accepted match and completion evidence.
- **Reproduction:** Baseline source used training + approved goal only, browser print, short match-derived ID and no admin management screen.
- **Expected / actual:** Full journey eligibility, stable non-enumerable ID, server PDF, participant ownership and admin cohort scope / baseline did not provide these.
- **Frequency:** Always in baseline.
- **Console/network:** None; design/business implementation gap.
- **Root cause / files:** Incomplete certificate implementation in `src/features/certificate/*` and route surface.
- **Fix applied:** Yes. Exact journey rules, deterministic SHA-256-derived ID, premium EN/FR preview, protected PDF API, participant and admin screens.
- **Verification:** Fixed; 3 ID tests, 4 browser tests, English/French PDF render inspection and direct-URL authorization checks passed.
- **Evidence:** `CERTIFICATE_REDESIGN_REPORT.md`, `certificate-evidence/`.

## AUD-ROUTE-001 — Proxy declares three public routes that return 404

- **Severity / feature:** P2 / public navigation and route policy
- **Role / URLs:** Public / `/programme`, `/mentor-guide`, `/mentee-guide`
- **Preconditions:** None.
- **Reproduction:** Request each URL directly.
- **Expected / actual:** A route declared public by `src/lib/auth/auth.config.ts` should exist or be removed from the declaration / all three return 404.
- **Frequency:** 100%.
- **Console/network:** HTTP 404.
- **Likely root cause / files:** Roadmap paths remained in `PUBLIC_PREFIXES` without App Router pages.
- **Fix applied:** Yes. Added real bilingual programme, mentor-guide and mentee-guide pages using approved repository programme behavior, metadata, responsive layout, navigation and footer links.
- **Verification:** Fixed; production-mode EN/FR direct navigation and screenshots pass with no 404 or redirect loop.
- **Evidence:** `tests/e2e/platform-audit.spec.ts`.

## AUD-I18N-001 — Messages workspace mixed English into French

- **Severity / feature:** P2 / localization and messages
- **Role / URL:** Mentor/Mentee / `/messages`
- **Preconditions:** French locale and an accepted pairing.
- **Reproduction:** Open messages in French.
- **Expected / actual:** All workspace labels in French / focus, assets and list labels were hardcoded English.
- **Frequency:** 100% before fix.
- **Console/network:** None.
- **Root cause / files:** Literal labels in `src/features/messages/messages-workspace.tsx`.
- **Fix applied:** Yes; labels moved to EN/FR message resources.
- **Verification:** Fixed; French mentee route sweep asserts “Axes du mentorat”.
- **Evidence:** `full-platform-evidence/browser/mentee-messages-fr-desktop.png`.

## AUD-AVATAR-001 — Missing private avatar object rendered a broken image

- **Severity / feature:** P2 / shell and storage resilience
- **Role / URL:** Authenticated users / all shell routes
- **Preconditions:** User record has an avatar key whose private object is unavailable.
- **Reproduction:** Load the shell for the affected safe seeded account.
- **Expected / actual:** Initials fallback / raw `<img>` displayed a broken image and `/api/avatar/[id]` returned 404.
- **Frequency:** 100% for a stale reference.
- **Console/network:** Expected private avatar 404.
- **Root cause / files:** `src/components/shell/app-shell.tsx` did not handle image failure.
- **Fix applied:** Yes; `ShellAvatar` falls back to initials for the failed URL.
- **Verification:** Fixed visually in subsequent route sweeps; API remains correctly private and returns 404 for missing content.

## AUD-RESP-001 — Mentee dashboard overflowed 390 px viewport by 128 px

- **Severity / feature:** P2 / responsive dashboard
- **Role / URL:** Mentee / `/dashboard/mentee`
- **Preconditions:** 390×844 viewport and populated dashboard cards.
- **Reproduction:** Sign in as a seeded mentee; compare document scroll width and client width.
- **Expected / actual:** No document-level horizontal overflow / +128 px, reproduced twice.
- **Frequency:** 100% before fix.
- **Console/network:** None.
- **Root cause / files:** CSS Grid children retained intrinsic minimum widths in `src/components/dashboard/mentee-summary.tsx`.
- **Fix applied:** Yes; `min-w-0` added to the grid and direct grid items.
- **Verification:** Fixed; the same Playwright assertion passes at 390 px. Full requested viewport matrix is separately recorded in the test matrix.
- **Evidence:** Playwright failure context in ignored `test-results/`; after screenshot in `full-platform-evidence/browser/mentee-dashboard-mobile.png`.

## AUD-UPLOAD-001 — Application upload limits exceed Vercel function payload limit

- **Severity / feature:** P2 / files and storage
- **Roles / URLs:** Mentee/Admin / profile, goal evidence, imports
- **Preconditions:** Production Vercel function path and file above approximately 4.5 MB.
- **Reproduction:** Source/config comparison: avatars allow 5 MB, evidence 10 MB, imports have no byte cap; Vercel functions accept 4.5 MB request/response payloads.
- **Expected / actual:** Every file accepted by application validation reaches storage / larger valid files can be rejected upstream with HTTP 413 before validation.
- **Frequency:** Deterministic above platform ceiling; multipart overhead lowers practical ceiling.
- **Console/network:** Expected `FUNCTION_PAYLOAD_TOO_LARGE`/413; not generated against production for safety.
- **Root cause / files:** Server-action proxy uploads in `src/features/profiles/actions.ts`, `goals/actions.ts`, `imports/actions.ts`.
- **Fix applied:** Yes. Implemented authenticated signed direct-to-Supabase uploads with scoped collision-safe paths, server confirmation, byte/signature validation, private references, post-success database writes, invalid-object cleanup and an explicit 20 MB import cap. Legacy server upload is compatibility-only.
- **Verification:** Code/test pass; non-confidential boundary and interrupted-upload validation remains staging-only.
- **Evidence:** `CAPACITY_AND_LOAD_TEST_REPORT.md`.

## AUD-ENV-001 — Production mail/calendar/enterprise SSO integrations are not configured

- **Severity / feature:** P1 / password reset, invites, calendar, SSO
- **Roles / URLs:** Public/Admin/Participants / forgot password, invites, meetings, login
- **Preconditions:** Current production environment listing.
- **Reproduction:** Read environment-variable names through Vercel CLI; no values were read. Microsoft Graph mail/calendar and Entra variables are absent.
- **Expected / actual:** Production recovery/invite mail and enterprise integrations use real providers / documented log/no-op fallbacks are selected.
- **Frequency:** Always until configured.
- **Console/network:** No destructive or real-email test was attempted.
- **Root cause / files:** Deployment configuration; `src/lib/mail/index.ts`, `src/lib/meetings/index.ts`, `src/lib/auth/auth.config.ts`.
- **Fix applied:** Application readiness complete: independent Entra/Graph health, sanitized startup/admin diagnostics, separate current variable names with legacy fallback, timeouts, token caching, calendar idempotency and graceful disabled states.
- **Verification:** Code and mock health tests pass; real SSO/mail/calendar remain blocked on owner credentials, consent and mailbox policy.
- **Evidence:** `capacity-evidence/infrastructure-snapshot.md`.

## AUD-AI-001 — Production AI provider health is not reliable

- **Severity / feature:** P2 / AI assistants
- **Roles / routes:** All authenticated roles / goals, sessions, meeting prep, insights, Atlas
- **Preconditions:** AI action in production.
- **Reproduction:** Prior repository QA captured Anthropic 401 and OpenAI 429; current environment names confirm both keys exist but values/quotas were not inspected.
- **Expected / actual:** Primary or fallback returns an advisory result / both providers can fail, leaving graceful manual fallback.
- **Frequency:** Historical observation; current frequency not measured.
- **Console/network:** Provider 401/429 in historical Vercel log evidence.
- **Root cause / files:** Provider account/quota configuration; adapters also lack explicit abort timeout/global concurrency queue.
- **Fix applied:** Application portion fixed with default four-request per-process concurrency and a configurable 20-second abort timeout; graceful manual fallback remains. Provider credentials/quota are owner-controlled.
- **Verification:** Code/build pass; provider success remains configuration-blocked.
- **Evidence:** `docs/qa-audit/QA_AUDIT_REPORT.md`, `CAPACITY_AND_LOAD_TEST_REPORT.md`.

## AUD-MSG-001 — Message sends have no per-user write throttle

- **Severity / feature:** P2 / messaging capacity and abuse resistance
- **Role / URL:** Mentor/Mentee / `/messages/[conversationId]`
- **Preconditions:** Authorized conversation participant.
- **Reproduction:** Inspect `sendMessage`; one request inserts a message, updates conversation, writes notifications and revalidates, with no `checkRateLimit` call.
- **Expected / actual:** Bounded message write rate / authenticated participant can generate unbounded write bursts within infrastructure limits.
- **Frequency:** Always.
- **Console/network:** None under normal use; destructive load not attempted.
- **Root cause / files:** `src/features/messages/actions.ts`.
- **Fix applied:** Yes. Shared per-user limits are 8 sends/10 seconds and 30/minute; conflicts return a retryable failure without writing.
- **Verification:** Code/type/build pass; destructive burst testing is staging-only.

## AUD-RT-001 — Realtime conversation channels are public content-free nudge channels

- **Severity / feature:** P2 / Realtime security and capacity
- **Role / URL:** Message participants / `/messages/[conversationId]`
- **Preconditions:** Publishable key and a guessed conversation CUID.
- **Reproduction:** Source review of `supabase.channel('conversation:<id>')` without private-channel authorization.
- **Expected / actual:** Only participants can publish conversation events / message content remains private, but an outsider with the public key and guessed ID could send a refresh nudge.
- **Frequency:** By design.
- **Console/network:** No content exposure; possible excess RSC refresh/database load.
- **Root cause / files:** `src/features/messages/message-thread.tsx`, Supabase Realtime settings.
- **Fix applied:** Yes at application layer. HMAC-SHA256 topics hide raw conversation IDs; authorized polling/visibility/online reconciliation, exact cleanup and send rollback/retry provide recovery without reload. Atomic direct-conversation identity is included in a pending migration.
- **Verification:** Focused tests pass; owner must apply the migration before deployment and run reconnect/multi-tab load in staging.

## AUD-I18N-002 — Residual admin surfaces contain hardcoded English

- **Severity / feature:** P2 / administrator localization
- **Role / URLs:** Super Admin / matching and import-detail surfaces
- **Preconditions:** French locale.
- **Reproduction:** Open admin matching/import detail; source contains English headings, insights and table labels outside translations.
- **Expected / actual:** Complete French UI / mixed-language fragments remain.
- **Frequency:** 100% on affected surfaces.
- **Console/network:** None.
- **Root cause / files:** `src/app/(admin)/admin/matching/page.tsx`, `src/app/(admin)/admin/imports/[id]/page.tsx` and related presentation copy.
- **Fix applied:** Yes. Matching, import detail and integration-health copy moved into reviewed English/French catalogues, including plurals, statuses, table headings and actions.
- **Verification:** Fixed; key parity/unit tests and admin browser routes pass.

## AUD-CHART-001 — Recharts emits negative-size warnings during admin rendering

- **Severity / feature:** P3 / insights and dashboard charts
- **Role / URL:** Super Admin / admin analytics routes
- **Preconditions:** Production-mode browser navigation during initial/container sizing.
- **Reproduction:** Navigate the admin route sweep.
- **Expected / actual:** No console/server-render warning / repeated width(-1), height(-1) warnings.
- **Frequency:** Reproduced during fresh sweep; charts still rendered.
- **Console/network:** Recharts negative width/height warning; no 5xx.
- **Root cause / files:** Responsive chart container initialization in admin chart components.
- **Fix applied:** Yes. Responsive containers now use a positive 1px initial dimension and `minWidth=0`. A first 600px attempt reproduced 81px overflow and was corrected.
- **Verification:** Fixed; the complete admin route sweep reran with no overflow or negative-size warning.

## AUD-DEV-001 — Lint passes with 20 React compiler/hook warnings

- **Severity / feature:** P3 / maintainability and performance
- **Roles / URLs:** Cross-platform.
- **Preconditions:** `npm run lint`.
- **Reproduction:** Run lint.
- **Expected / actual:** Zero errors and ideally zero warnings / zero errors, 20 pre-existing warnings after the new avatar code was kept warning-free.
- **Frequency:** 100%.
- **Console/network:** `react-hooks/set-state-in-effect` and `react-hooks/refs` warnings.
- **Root cause / files:** Form reset effects, local/offline hooks, animation state and shell effects.
- **Fix applied:** Yes. Removed render-time ref writes, derived transient search state, deferred external hydration, removed unnecessary mount/route reset effects and initialized state safely without broad rule suppression.
- **Verification:** Fixed; lint reports 0 errors and 0 warnings.

## AUD-AUTHLOG-001 — Expected invalid credentials emit a full Auth.js error stack

- **Severity / feature:** P3 / authentication observability
- **Role / URL:** Public / `/login`
- **Preconditions:** Submit an invalid password.
- **Reproduction:** Run the production-mode auth browser test.
- **Expected / actual:** Generic client error with concise structured server event / UI is generic, but Auth.js writes `CredentialsSignin` plus a production stack trace.
- **Frequency:** Every invalid credentials attempt in the local production build.
- **Console/network:** Server log only; no password, token or cookie was present in captured output.
- **Root cause / files:** Default Auth.js logger behavior in `src/lib/auth/auth.ts`.
- **Fix applied:** Yes. Expected `CredentialsSignin` is reduced to a concise structured event; unexpected authentication errors retain error reporting.
- **Verification:** Fixed; invalid-login browser test remains generic and the full expected stack is absent.

## Not defects / owner decisions

- Only `SUPER_ADMIN`, `MENTOR`, and `MENTEE` exist. Programme Admin, Trainer and Reviewer were explicitly folded into Super Admin; testing them as separate roles is not applicable.
- No distinct user-management, audit-log, community forum, newsletter or clinic-management routes exist. These are roadmap/not-implemented items, not regressions introduced by this audit.
- Certificate legal wording, real signatory names/titles and an official seal asset require programme-owner approval. The implementation does not fabricate them.
