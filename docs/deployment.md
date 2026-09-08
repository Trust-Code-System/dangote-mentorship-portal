# Deployment (Vercel + Supabase)

The app runs on **Vercel** (Next.js) with **Supabase** providing Postgres and
Storage. Identity stays **Auth.js + Entra** — Supabase Auth is not used.

## Prerequisites (one-time, already done for the current project)

- Supabase project `Dangote Mentorship` (ref `whgzjjjiruhluqxjjacy`, region
  `eu-central-1` / Frankfurt).
- Database migrated + seeded:
  ```
  npm run prisma:deploy   # applies migrations (uses DIRECT_URL)
  npm run db:seed         # loads the bilingual demo cohort
  ```
- Private Storage bucket `portal-files` (auto-created by
  `scripts/test-supabase-storage.mjs`; verify it stays **Private**).

## Vercel project settings

- **Framework preset:** Next.js
- **Build command:** `next build` (default). `postinstall: prisma generate`
  (in package.json) regenerates the Prisma client on every install — required,
  or Vercel's cached client goes stale and the build fails.
- **Install / Output:** defaults.
- **Production branch:** `main`.

> `next build` does NOT run migrations. Apply schema changes yourself with
> `npm run prisma:deploy` against Supabase before/after deploying, or add it to
> the Vercel build command if you want it automatic.

## Environment variables (Vercel → Settings → Environment Variables)

Set for **Production** (and Preview if you use preview deploys). Pull the real
values from your local `.env` — never commit them.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler, `:6543`, `?pgbouncer=true` |
| `DIRECT_URL` | Supabase session pooler, `:5432` (migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` (browser-safe; M4 Realtime) |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` (server-only; Storage) |
| `SUPABASE_STORAGE_BUCKET` | `portal-files` |
| `AUTH_SECRET` | 32+ byte random (`npx auth secret`) |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_URL` | the deployed origin, e.g. `https://<app>.vercel.app` — set after first deploy, then redeploy |

Optional / feature-gated (the app hides these features when unset):
`AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_TENANT_ID` (Entra SSO),
`ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) for AI assistants,
`MAIL_GRAPH_*` for email, `CRON_SECRET` for scheduled notifications.
Microsoft Entra, Graph mail, and Graph calendar are additionally fail-closed:
leave `MICROSOFT_INTEGRATIONS_ENABLED=false` until the owner explicitly approves
their tenant configuration. Credentials alone do not activate those services.
Do **not** set the `SEED_*` vars in production (local seeding only).

## First deploy

1. Add the env vars above (skip `AUTH_URL` for now).
2. Deploy.
3. Copy the assigned `https://<app>.vercel.app` domain into `AUTH_URL` and
   redeploy so Auth.js callbacks resolve.
4. If using Entra SSO, add `https://<app>.vercel.app/api/auth/callback/microsoft-entra-id`
   as a redirect URI in the Entra app registration.

## Storage on serverless

The local-filesystem storage provider writes to disk and will NOT work on
Vercel's read-only serverless filesystem. As long as the Supabase env vars are
set, `getStorageProvider()` selects the Supabase provider automatically. Force
it explicitly with `STORAGE_PROVIDER=supabase` if needed.

## Secret hygiene

Rotate secrets that have been exposed: DB password (Supabase → Settings →
Database → Reset; update `DATABASE_URL`/`DIRECT_URL` in Vercel + local `.env`)
and `AUTH_SECRET` (`npx auth secret`; rotating invalidates existing sessions).

## Database migrations (gated release step) — M8

`next build` does NOT run migrations (see note above). Treat schema changes as a
deliberate, gated step so drift can't reach prod silently:

1. Open a PR with the new `prisma/migrations/*` directory; CI typecheck/test must pass.
2. After merge, before (or as part of) the production deploy, run:
   ```bash
   npm run prisma:deploy   # prisma migrate deploy — idempotent, applies pending only
   ```
   Run it from a trusted environment with `DIRECT_URL` set to the Supabase session
   pooler. To automate, set the Vercel **Build Command** to
   `prisma migrate deploy && next build` (accept that a failed migration then fails
   the deploy — usually what you want).
3. Never edit an already-applied migration; add a new one. Never run
   `prisma db push` against production.

## Backups, restore & retention — M7

**Backups.** Supabase takes automated daily backups; on Pro+, enable **Point-in-Time
Recovery (PITR)** for the production project (Dashboard → Database → Backups).
Confirm the retention window matches the cohort data-retention policy below.

**Restore drill (run at least once before launch, then quarterly).**
1. Create a throwaway Supabase project (or branch).
2. Restore the latest backup / PITR snapshot into it.
3. Point a local `.env` `DIRECT_URL` at the restored DB and run
   `npx prisma migrate status` — expect "Database schema is up to date".
4. Spot-check row counts for `users`, `cohorts`, `matches`, `messages`.
5. Record the wall-clock restore time (your effective RTO) in the launch checklist.

**Data retention / right-to-delete (CLAUDE.md §14).** All primary entities are
soft-deleted (`deletedAt`) — content is never hard-deleted in-app. Define per
cohort, at programme close:
- how long soft-deleted rows and confidential records (agreements, messages) are
  kept before a scheduled hard purge;
- the right-to-export / right-to-delete process for an individual on request.
Document the chosen windows here once Dangote confirms its policy; until then the
default is "retain for the programme lifetime, purge on explicit admin request".

## Error tracking — Sentry setup

Sentry is wired (server + edge + browser via `withSentryConfig`) but inert until
you give it a DSN. To turn it on:

1. Create a project at <https://sentry.io> (platform: **Next.js**).
2. Project → **Settings → Client Keys (DSN)** — copy the DSN.
3. In **Vercel → Settings → Environment Variables** (Production, and Preview if
   used), add:
   - `SENTRY_DSN` = the DSN (server + edge capture)
   - `NEXT_PUBLIC_SENTRY_DSN` = the same DSN (browser capture)
   - *(optional)* `SENTRY_TRACES_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_RATE` to tune
     tracing volume (default `0.1`).
4. *(optional, recommended)* For readable stack traces, enable build-time
   source-map upload by also setting `SENTRY_ORG`, `SENTRY_PROJECT`, and
   `SENTRY_AUTH_TOKEN` (Sentry → Settings → Auth Tokens, scope `project:releases`).
   Without these the build still succeeds; traces are just minified.
5. Redeploy. Verify by throwing a test error (or visiting a route that 500s) and
   confirming it lands in Sentry.

The CSP already allows `https://*.sentry.io` in `connect-src`, so browser events
aren't blocked. No tunnel route is used.

## Shared rate limiting — Upstash setup

Auth + AI rate limiting falls back to a per-process in-memory store, which barely
throttles across Vercel's many serverless instances. Back it with Upstash Redis:

1. Create a database at <https://upstash.com> (Redis; pick the region closest to
   the app — e.g. `eu-central-1` to match Supabase Frankfurt).
2. In the database's **REST API** panel, copy `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
3. Add both to **Vercel → Environment Variables** (Production + Preview).
4. Redeploy. `checkRateLimit` (`src/lib/auth/rate-limit-shared.ts`) auto-detects
   them and switches to the shared, atomic store; with them unset it stays on the
   in-memory limiter. It **fails open** — if Upstash is unreachable it allows the
   request rather than locking users out.

> Local dev: leave both unset to use the in-memory limiter, or point them at a
> personal Upstash DB to exercise the shared path.
