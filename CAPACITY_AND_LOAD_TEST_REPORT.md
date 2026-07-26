# BLAK MOH Capacity and Load Test Report

**Assessment status:** `REMEDIATED_LOCALLY_STAGING_VALIDATION_REQUIRED`
**Updated:** 2026-07-26
**Production load test:** Not performed

## Executive conclusion

Clear application bottlenecks from the audit were remediated: direct uploads no longer send large file bodies through Vercel functions, message writes are throttled, direct conversations use atomic provisioning, Realtime recovery is bounded, and AI/Graph requests have concurrency/idempotency/timeout controls.

The remediation rerun on the local production build had 0% errors and a healthy database before/after, but it crossed the p95 <2s threshold at **25 anonymous public VUs**. It stopped automatically and did not attempt 50 or 100. The conservative current local safe point is therefore **10 public VUs within thresholds**.

An earlier same-day run passed 50 and failed latency at 100. The variation confirms that local-host numbers are not production capacity. Until isolated staging measures database-backed workloads with telemetry, operate a small pilot and do not publish a higher concurrency claim.

## Before and after

| Run | Highest stage inside all thresholds | First failed stage | Error behavior | Interpretation |
|---|---:|---:|---|---|
| Original audit | 50 VUs | 100 VUs | 0% errors | Local host was warm/less contended; not production proof |
| Remediation rerun | 10 VUs | 25 VUs (p95) | 0% errors | Conservative current release evidence; stop worked correctly |

### Remediation rerun measurements

Target: local `next start` on port 3002. Anonymous read-only routes: `/`, `/about`, `/faq`, `/login`. Thresholds: error rate <1%, p95 <2s, p99 <4s.

| VUs | Requests | RPS | p50 | p95 | p99 | Errors | Result |
|---:|---:|---:|---:|---:|---:|---:|---|
| 5 | 117 | 11.49 | 356 ms | 794 ms | 2,055 ms | 0 | Pass |
| 10 | 167 | 16.57 | 585 ms | 832 ms | 911 ms | 0 | Pass |
| 25 | 167 | 16.34 | 1,508 ms | 2,238 ms | 2,401 ms | 0 | Fail p95; stop |

The p99 spike at 5 VUs remained below the 4s threshold. Database readiness was `up` before and after. Evidence: `capacity-evidence/public-load-results.json`.

## Software remediation

### Uploads and Vercel payloads

- Profile photos (5 MB), goal evidence (10 MB), and imports (20 MB) now use authorized signed direct-to-Supabase upload targets when configured.
- Server confirmation reads the private object by reference and validates size, extension/MIME, signature, ownership/scope, and workflow state.
- Database references are written only after successful confirmation.
- Invalid temporary objects are removed; successful import temporaries are removed after processing.
- The legacy server-action route remains only as a compatibility fallback for environments without direct upload configuration.
- Vercel's 4.5 MB function payload ceiling is no longer the normal path for correctly configured production uploads.

### Messages and Realtime

- Stable unique direct-conversation keys plus atomic upsert remove concurrent duplicate provisioning.
- Pair conversation provisioning is parallel rather than sequential.
- Message sends are limited to 8/10 seconds and 30/minute per user.
- Opaque HMAC topics prevent raw conversation IDs from being guessed as broadcast topics.
- Realtime subscription cleanup, online/visibility recovery, 15-second authenticated reconciliation, and optimistic rollback/retry bound refresh and failure behavior.

### AI and Microsoft Graph

- AI calls use a per-process semaphore (default 4) and an abort timeout (default 20s).
- Graph token acquisition is cached per tenant/client and times out after 10s.
- Graph mail times out after 15s and is not retried after an ambiguous send.
- Calendar writes use a stable `transactionId`, 15s timeout, and one retry only for explicit 429/503 responses.

### Browser/runtime

- Recharts receives a positive 1px initial width, eliminating negative-size warnings without overflowing narrow cards.
- Twenty React compiler/hook warnings were fixed, reducing avoidable effect/ref work.

## Architecture constraints still requiring owner visibility

### PostgreSQL/Supabase

- PostgreSQL snapshot: `max_connections=60`; 21 total connections were observed during the original audit.
- The application uses the Supavisor pooler URL, appropriate for serverless execution.
- The configured hosted database has the new direct-conversation migration pending; code must not deploy before the controlled migration.
- Supabase CPU/RAM, pool wait, query p95, Realtime clients, storage quota, and plan name were unavailable.

### Vercel

- Region alignment remains `fra1` with the Supabase EU Central pool endpoint.
- Vercel runtime scaling is unlikely to be the first bottleneck; database/provider quotas and expensive authenticated work dominate.
- Fluid Compute, function memory, spend limits, and current plan require owner confirmation.

### External providers

- Entra/Graph are disabled without owner tenant values.
- AI provider success remains unqualified because historical evidence included Anthropic 401 and OpenAI 429.
- Application controls limit blast radius but do not create provider quota.

## Qualified operating envelope

| Workload | Current recommendation | Confidence |
|---|---:|---|
| Anonymous local public browsing | 10 concurrent VUs within current rerun thresholds | High for this local rerun only |
| Registered accounts | No application hard cap | Architecture only |
| Idle JWT sessions | Not connection-bound | Architecture only |
| Database-active pilot users | Keep small; target 10 until staging proves more | Conservative |
| Heavy admin users | 5 concurrent pending staging | Low |
| Open message users | 25 pending Realtime-plan confirmation and staging | Low |
| Simultaneous AI calls | 4 per server process by code default | High for application bound; provider capacity unknown |
| Large uploads | 5/10/20 MB through signed direct upload when configured | Code-confirmed; staging boundary test required |

These are operational guardrails, not contractual production limits.

## Required staging validation

The owner must create isolated Vercel/Supabase staging with synthetic users, apply all migrations, and authorize a bounded test. Measure:

1. authenticated mentee/mentor dashboards and navigation;
2. admin insights and cohort queries;
3. credentials login/bcrypt bursts;
4. message sends, subscriptions, reconnect, visibility changes, and multiple tabs;
5. 5/10/20 MB direct-upload boundaries and interrupted uploads;
6. AI 401/429/timeout/fallback and actual provider quotas;
7. Graph mail/calendar idempotency using approved test identities;
8. Supabase CPU, RAM, pool clients/waits, query p95, Realtime clients, storage and egress;
9. Vercel function duration, memory, errors, region, and spend.

Stop at error rate ≥1%, p95 ≥2s, p99 ≥4s, or 70% of a provider/database quota. See `OWNER_ACTIONS_REQUIRED.md`.

## Evidence and safety

- `capacity-evidence/public-load-results.json`
- `capacity-evidence/database-snapshot.json`
- `capacity-evidence/infrastructure-snapshot.md`
- `load-tests/public-readonly.mjs`
- `tests/load/smoke.js`

No production stress, hosted schema mutation, login storm, message-send load, real email/notification, provider setting change, secret read, deployment, or destructive action was performed.
