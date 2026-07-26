# BLAK MOH Platform Audit Master Specification

Date opened: 2026-07-25
Repository: `dangote-mentorship-portal`
Audit target: local application at `http://localhost:3000`, backed by the configured Supabase project

## Objective and execution order

1. Redesign and verify both the certificate-management experience and generated certificate output.
2. Audit the complete public, participant, and administrator product lifecycle.
3. Assess registered-account, authenticated-session, active-user, database, realtime, upload, login, and AI capacity separately.

No existing feature, route, role grant, language, authentication path, storage seam, realtime behavior, or AI-assisted workflow may be removed to improve the result. Confirmed, low-risk defects may be fixed only after they are reproduced.

## Discovered architecture

- Framework: Next.js 16.2.11 App Router, React 19, TypeScript strict mode.
- Package manager/runtime: npm 11 on Node 22; `package-lock.json` is authoritative.
- Data: PostgreSQL through Prisma 6.2.1. The configured pooled database endpoint is in AWS `eu-central-1` (Frankfurt).
- Supabase: hosted project for PostgreSQL, private Storage (`portal-files`), and Realtime messaging. Browser access uses the publishable key; server access uses a secret key.
- Authentication: Auth.js v5 beta with credentials fallback and optional Microsoft Entra ID. Authorization is re-read from the database on every protected server request.
- Active product roles: `SUPER_ADMIN`, `MENTOR`, and `MENTEE`. The repository constitution mentions Programme Admin, Trainer, and Reviewer, but the implemented schema intentionally folds staff capabilities into Super Admin; this mismatch is an audit finding, not a permission change.
- Localization: next-intl with cookie-persisted English/French locale and no locale-prefixed routes.
- Files: provider abstraction with a private local/Supabase implementation and authorized download route handlers.
- PDF: `pdf-lib` server rendering for agreements; certificates initially used browser print only.
- Realtime: Supabase channels scoped to conversations.
- AI: server-only provider adapters with human review before persistence.
- Cache: React request cache for current-user lookup; Next client router stale times are 60 seconds dynamic and 300 seconds static. Private content is not persisted in local storage.
- Deployment: linked Vercel project; cron notification handler at 07:00 UTC. No explicit Vercel function region is committed, so runtime-region alignment must be verified in the Vercel project settings.
- Boundaries: root, dashboard, public, and admin loading/error boundaries exist. Several leaf routes have dedicated loading or error boundaries.

## Baseline health

- Runtime service probe: database reachable (46 users, 2 cohorts, 1 message); private storage reachable.
- TypeScript baseline: pass.
- Vitest baseline: pass for the completed run.
- Local server: listening on port 3000.
- Browser audit daemon: packaged binary is present but its server dependency is incomplete on Windows; Playwright is the evidence fallback and remains a real browser test, not a code-only substitute.

## Certificate acceptance gates

- The participant route remains `/certificate` and is owner-scoped.
- A new administrator route may manage certificates without weakening existing permissions.
- Eligibility must match the existing journey completion rule: training completed, an approved/completed goal, submitted mid-term review, and submitted final review.
- Certificate identifiers must be stable, deterministic, collision-resistant, and based on real match data.
- Ineligible output must remain unmistakably a preview and must never be downloadable as an official certificate by a participant.
- PDF output must be generated server-side, landscape, high-resolution/vector where practical, private/no-store, bilingual, and tested with long and accented names.
- English and French output must never mix languages.
- No fake signatures or invented verification route may be added.

## Audit evidence policy

- Every browser result is backed by a screenshot, trace, console/network observation, or automated assertion.
- Credentials, session cookies, provider keys, and private participant content are excluded from all artifacts.
- Safe seeded records only. No real emails, invites, notifications, or destructive production traffic.
- Blocked tests state the missing account, provider, plan detail, or owner decision explicitly.

## Severity and release gates

- P0: active compromise, destructive loss, or platform-wide outage.
- P1: authorization/privacy failure, core lifecycle failure, or frequent route crash.
- P2: important degraded workflow, accessibility barrier, localization defect, or material performance issue.
- P3: low-impact polish or resilience improvement.

Release recommendation cannot exceed `READY WITH CONDITIONS` while any P1 is open, and cannot exceed `NOT READY` while any P0 is open.
