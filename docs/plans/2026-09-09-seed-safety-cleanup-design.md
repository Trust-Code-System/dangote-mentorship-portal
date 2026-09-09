# Seed Safety Cleanup Design

## Goal

Keep PR #63's credential and database-pinning protections while reducing its review surface and closing the malformed-URL bypass.

## Design

- Keep explicit seed credentials and avoid printing the password.
- Treat `SEED_ALLOW_REMOTE` as the environment string it is: `"true"` allows any valid remote database target; `host:port/database` allows only that exact target.
- Reject missing or malformed database URLs before considering either override.
- Remove generated Supabase CLI files because the application and this change do not use them.
- Retain comments only where they explain the security invariant; rely on names and tests for mechanics.

## Verification

Add a regression test for malformed URLs with the broad override, run the focused unit suite, then run typecheck, lint, tests, and the production build after integrating current `main`.
