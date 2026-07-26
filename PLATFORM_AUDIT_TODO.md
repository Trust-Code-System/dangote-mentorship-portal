# BLAK MOH Platform Audit TODO

Status legend: `[ ]` not started · `[~]` in progress · `[x]` completed · `[!]` blocked

## Phase 1 — Discovery

- [x] Identify framework, runtime, package manager, deployment, and test tooling.
- [x] Inventory App Router pages, layouts, loading/error boundaries, and API handlers.
- [x] Inspect Auth.js, live RBAC, role grants, cohort scoping, and middleware behavior.
- [x] Inspect Prisma schema, migrations, Supabase endpoints, storage, and Realtime seams.
- [x] Inspect English/French resources and locale persistence.
- [x] Inspect certificate data, rendering, identifiers, and current print behavior.
- [x] Record route-level APIs, server actions, data dependencies, and test results.

## Phase 2 — Certificate redesign

- [x] Align certificate eligibility with the existing completion journey.
- [x] Replace short collision-prone IDs with stable deterministic identifiers.
- [x] Build premium bilingual browser preview using the official logo and print-safe brand system.
- [x] Build private server-rendered landscape PDF output.
- [x] Add administrator candidate selection, cohort context, language selection, status, preview, generate/download, and regenerate controls.
- [x] Verify participant self-access and deny unrelated/direct URL access.
- [x] Test short, long, hyphenated, apostrophe, accented, and uppercase names.
- [!] Capture before/after evidence: after-state and PDF evidence complete; browser “before” blocked by the audit-browser startup failure before the first edit. Git baseline source documents the prior state; no evidence was fabricated.

## Phase 3 — Full platform audit

- [x] Public pages, links, metadata, responsiveness, and localization.
- [!] Authentication redirect/guards tested; real reset/invite delivery, SSO and maintenance mutation blocked by configuration/safety.
- [x] Matched mentee lifecycle and role route set; unmatched behavior covered by current unit/source evidence.
- [x] Single- and multi-mentee mentor routing/access reviewed and browser route set passed.
- [x] Super Admin lifecycle surfaces rendered; destructive admin mutations deliberately excluded.
- [x] Direct server-side authorization, cohort isolation, IDOR, storage, and cache privacy.
- [!] Messaging/pair stability, duplicate prevention, throttling, retry/reconnect and cleanup remediated; destructive Realtime/multi-tab load requires the pending migration and staging.
- [!] AI guardrails, concurrency and timeouts remediated; current provider success and quotas remain blocked by owner/provider configuration.
- [x] Oversized avatar, goal-evidence and import flows moved to authenticated signed direct storage with server confirmation and explicit limits.
- [x] English/French parity, accents, certificate dates, HTML language, persistence and missing-key tests; residual admin matching/import/settings copy remediated.
- [!] Required viewport matrix passed and semantic smoke completed; formal axe/pa11y, screen-reader, contrast and 200% zoom certification blocked by tooling.
- [!] Build, local load, region, cache, bundle and navigation checks complete; Core Web Vitals/provider telemetry require production/staging observability.

## Phase 4 — Safe remediation

- [x] Log every confirmed defect and reconstruct the remediation sequence in the final defect log.
- [x] Fix reproducible low-risk P0–P2 defects in severity order.
- [x] Add targeted regression tests and re-run browser verification.
- [x] Document owner decisions without silently implementing them.

## Phase 5 — Capacity

- [x] Inventory Vercel, Supabase, database-pool, Auth, Realtime, Storage, AI, mail and Graph constraints.
- [x] Build secret-free k6/Playwright and Node read-only scenarios; authenticated/messaging/admin load remains staging-only by policy.
- [x] Run gradual safe local public tests at 5, 10, 25, 50 and 100; stop before 200 when latency thresholds fail.
- [x] Record p50/p95/p99, throughput, errors, health and database connection snapshot.
- [x] Separate measured safe concurrency, observed breaking point and qualified production estimate by workload.

## Phase 6 — Post-audit remediation

- [x] Restore `/programme`, `/mentor-guide`, and `/mentee-guide` without removing routes.
- [x] Replace the normal oversized server-action upload path with authorized signed direct uploads and confirm-by-reference metadata writes.
- [x] Complete residual administrator EN/FR localization and key-parity coverage.
- [x] Add stable direct-conversation identity, atomic provisioning, opaque Realtime topics, cleanup/recovery, failed-send retry and message throttles.
- [x] Separate Entra, Graph mail and Graph calendar health/configuration; add sanitized diagnostics, timeouts and calendar idempotency.
- [x] Bound AI concurrency and provider duration.
- [x] Fix all 20 documented lint warnings without global suppression.
- [x] Fix Recharts negative-size initialization and the first-remediation narrow-card overflow regression.
- [x] Rerun typecheck, lint, full unit suite, production build, public/admin/mobile/viewport browser tests and safe local load.
- [!] Apply `20260726120000_harden_direct_conversations` and run authenticated messaging/upload/load validation in isolated staging (owner).
- [!] Configure and consent Entra/Graph and validate AI provider health (owner).
- [x] Produce post-remediation and owner-action handoff reports.

## Required deliverables

- [x] `PLATFORM_AUDIT_MASTER_SPEC.md`
- [x] `PLATFORM_AUDIT_TODO.md`
- [x] `PLATFORM_ROUTE_INVENTORY.md`
- [x] `CERTIFICATE_REDESIGN_REPORT.md` and `certificate-evidence/`
- [x] `FULL_PLATFORM_AUDIT_REPORT.md`
- [x] `FULL_PLATFORM_TEST_MATRIX.md`
- [x] `FULL_PLATFORM_DEFECT_LOG.md`
- [x] `FULL_PLATFORM_ROUTE_INVENTORY.md`
- [x] `CAPACITY_AND_LOAD_TEST_REPORT.md`, `load-tests/`, and `capacity-evidence/`
- [x] `full-platform-evidence/` category tree
- [x] `POST_AUDIT_REMEDIATION_REPORT.md`
- [x] `OWNER_ACTIONS_REQUIRED.md`
