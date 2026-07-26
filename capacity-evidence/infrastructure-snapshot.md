# Infrastructure snapshot

Captured 2026-07-26 through read-only CLI, environment-name, DNS/configuration and SQL checks.

- Vercel production deployment: Ready; functions located in `fra1`; observed route bundle 68.88 MB.
- Vercel project setting: Node.js 24.x. `package.json` constrains Node to `>=22 <23`; Vercel documents that a valid `engines.node` range overrides the project setting, so deployments should select Node 22.x. Runtime logging was not added solely for this audit.
- Supabase database endpoint: Supavisor pooler in `eu-central-1`; production Vercel and database regions are aligned in Frankfurt.
- PostgreSQL: 17.6; `max_connections=60`; 21 total connections observed (1 active, 13 idle); 15 connections attributed to the current database.
- Current database size: 18,640,019 bytes; cumulative cache-hit ratio about 99.992%; zero recorded deadlocks.
- Production environment names confirm Upstash Redis, Sentry, Supabase storage, S3 storage, Anthropic and OpenAI variables. Values were not read or recorded.
- Microsoft Graph mail/calendar and Entra ID environment names were absent from the production environment listing. The application therefore uses its documented no-op/log fallbacks for those integrations.
- Vercel plan, Supabase subscription, Supabase compute label, Realtime configured quotas, Storage global/bucket limits, AI account quotas, and provider CPU/RAM telemetry were not accessible.

No secret values, deployment IDs, project IDs, tokens, URLs containing credentials, or private participant data are stored here.
