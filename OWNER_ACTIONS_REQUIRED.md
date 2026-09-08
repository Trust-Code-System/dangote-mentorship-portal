# BLAK MOH Owner Actions Required

**Prepared:** 2026-07-26
**Scope:** actions that cannot be completed safely from source code without tenant, deployment, infrastructure, provider, or legal authority.

No credentials belong in this document. Enter secrets only in the appropriate Microsoft, Supabase, or Vercel control plane.

## Required before production completion

### 1. Verify the direct-conversation migration on the deployment database

- **Exact action:** confirm which Supabase project is referenced by Vercel production `DATABASE_URL` and `DIRECT_URL`, then run `npx prisma migrate status` against that target and verify migration `20260726120000_harden_direct_conversations` in `_prisma_migrations`.
- **Why:** the migration was successfully deployed through Prisma to the workspace-configured database, and the owner also ran the corresponding SQL in Supabase. The dashboard screenshot and workspace configuration referenced different project IDs, so the production deployment target still needs an explicit, secret-free reconciliation.
- **Where:** Vercel project environment settings and the selected Supabase project's database/migration history.
- **Value/decision needed:** identify the intended production database target; do not paste connection strings into chat or this document.
- **Payment:** no expected incremental cost.
- **Administrator access:** database/deployment administrator required.
- **If omitted:** an environment can still lack `direct_key`, causing the new messaging code to fail there.
- **Verification:** migration status reports no pending migration, `conversations.direct_key` has its unique index, and repeatedly opening Messages for one pair creates only one conversation.

### 2. Confirm Supabase upload limits and lifecycle policy

- **Exact action:** the final runtime check confirms the configured storage service is reachable and private. Keep `portal-files` (or the value of `SUPABASE_STORAGE_BUCKET`) private, keep the Supabase secret key server-only, confirm the 5/10/20 MB boundaries in isolated staging, and set an object-lifecycle cleanup policy for unconfirmed temporary uploads where the plan supports it.
- **Why:** avatars, goal evidence, and CSV/Excel imports now upload directly with one-time signed targets, avoiding Vercel's 4.5 MB function-body ceiling. Private storage and abandoned-object cleanup complete the operational boundary.
- **Where:** Supabase Dashboard → Storage and project settings. Configure the matching Vercel environment variables.
- **Value/decision needed:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key), `SUPABASE_SECRET_KEY`, and `SUPABASE_STORAGE_BUCKET`.
- **Payment:** lifecycle/retention and storage quotas may depend on the Supabase plan.
- **Administrator access:** Supabase project administrator required.
- **If omitted:** the code falls back to the legacy server upload for environments without direct upload configuration, so files above Vercel's payload ceiling can fail; abandoned uploads cannot be aged out automatically.
- **Verification:** admin Settings shows no storage error; use non-confidential staging files at the 5 MB avatar, 10 MB evidence, and 20 MB import boundaries; confirm the bucket remains private and no database row is created for an interrupted upload.

### 3. Configure Microsoft Graph mail

- **Current status:** intentionally disabled by owner on 2026-07-26. `MICROSOFT_INTEGRATIONS_ENABLED=false` is configured in Vercel production and preview and takes effect with this deployment; credentials alone cannot activate Graph mail, Graph calendar, or Entra SSO.

- **Exact action:** create or select a dedicated Entra app registration for server-side mail, create a client secret/certificate, grant Microsoft Graph **Application** permission `Mail.Send`, grant tenant-wide admin consent, and scope the application to the approved sender mailbox with Exchange Online Application RBAC (or an application access policy where still used).
- **Why:** password reset, invitation, and notification email cannot be production-complete while mail is disabled.
- **Where:** Microsoft Entra admin center → App registrations → API permissions / Certificates & secrets; Exchange admin center or Exchange Online PowerShell for mailbox scoping; Vercel project environment settings for values.
- **Values required:** `GRAPH_MAIL_TENANT_ID`, `GRAPH_MAIL_CLIENT_ID`, `GRAPH_MAIL_CLIENT_SECRET`, `GRAPH_MAIL_SENDER`.
- **Where values come from:** tenant ID and client ID from the app registration Overview; the secret value is shown once when created; sender is the approved licensed user or shared mailbox SMTP address.
- **Payment:** a suitable Microsoft 365/Exchange mailbox licence may be required.
- **Administrator access:** Entra administrator for consent and Exchange administrator for mailbox scoping.
- **If omitted:** reset/invite flows remain enumeration-safe but real mail is not delivered.
- **Redeployment:** required after Vercel environment variables change.
- **Verification:** admin Settings reports Graph mail **Configured**; in staging send one approved test reset/invite to an owner-controlled mailbox, verify one delivery only, and inspect logs for status-only errors without message bodies or secrets.
- **Reference:** [Microsoft Graph sendMail permissions](https://learn.microsoft.com/graph/api/user-sendmail), [Exchange application RBAC](https://learn.microsoft.com/exchange/permissions-exo/application-rbac).

### 4. Configure Microsoft Graph calendar if Outlook synchronization is in production scope

- **Current status:** intentionally disabled by owner on 2026-07-26; keep it disabled until a separate tenant approval.

- **Exact action:** create or select a separate Graph calendar app registration, grant Microsoft Graph **Application** permission `Calendars.ReadWrite`, grant admin consent, and scope mailbox access.
- **Why:** meeting creation currently degrades safely when calendar integration is disabled; real Outlook events require tenant authority.
- **Where:** Microsoft Entra admin center, Exchange Online application scoping, and Vercel environment settings.
- **Values required:** `GRAPH_CALENDAR_TENANT_ID`, `GRAPH_CALENDAR_CLIENT_ID`, `GRAPH_CALENDAR_CLIENT_SECRET`.
- **Payment:** Microsoft 365/Exchange licensing may be required.
- **Administrator access:** Entra and Exchange administrators required.
- **If omitted:** portal meetings still work, but Outlook event synchronization remains disabled.
- **Redeployment:** required.
- **Verification:** admin Settings reports Graph calendar **Configured**; create one staging meeting, verify exactly one event and its cancellation, and confirm retries do not duplicate it (the code supplies a stable Graph `transactionId`).
- **Reference:** [Microsoft Graph create event permissions](https://learn.microsoft.com/graph/api/user-post-events).

### 5. Configure Microsoft Entra single sign-on if enterprise SSO is required

- **Current status:** intentionally disabled by owner on 2026-07-26; password sign-in remains the supported method.

- **Exact action:** create or select an Entra web app registration, configure the web redirect URIs, issue a credential, and approve the organisation's sign-in policy.
- **Why:** the application intentionally omits a partially configured provider so password sign-in stays available; enterprise SSO cannot be verified without tenant values.
- **Where:** Microsoft Entra admin center → App registrations → Authentication / Certificates & secrets; Vercel environment settings.
- **Values required:** `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
- **Redirect URIs:** `https://<production-domain>/api/auth/callback/microsoft-entra-id` and the corresponding staging/preview callback for every environment that will test SSO. Do not use a wildcard.
- **Permissions/consent:** standard OpenID Connect delegated scopes (`openid`, `profile`, `email`); tenant policy determines whether administrator consent is required. No Graph mail/calendar application permission is needed on this SSO registration unless the owner deliberately combines registrations.
- **Payment:** normally no incremental Entra app-registration charge; tenant licensing/policies may vary.
- **Administrator access:** Entra app administrator; tenant admin if consent/policy requires it.
- **If omitted:** password sign-in continues; the Entra button remains hidden and SSO remains incomplete.
- **Redeployment:** required.
- **Verification:** admin Settings reports Entra **Configured**; sign in on staging with an approved work account, confirm it links to the pre-created portal identity, then verify role and cohort access are unchanged.

### 6. Provision isolated staging and run the gated validation

- **Status:** blocked only pending cost confirmation.
- **Exact action:** create a Supabase development branch named `blak-moh-staging` from Dangote Mentorship, configure it as the data/Storage/Realtime target of a separate Vercel staging project, seed synthetic users, apply all migrations, and authorize read/write load tests only against staging.
- **Why:** authenticated dashboards, message sends, Realtime reconnect/multiple tabs, login bursts, large direct uploads, Graph callbacks, and true database saturation were deliberately not stressed against the hosted environment.
- **Where:** Vercel, Supabase, Microsoft tenant test configuration, and the repository load/Playwright scripts.
- **Value/decision needed:** explicit confirmation of the ongoing Supabase branch charge, staging URLs, test-user credentials, test window, maximum VUs, stop thresholds, and named observer for Supabase/Vercel telemetry.
- **Payment:** **$0.01344/hour** for the Supabase branch, approximately **$9.81/month** (730 hours) or **$117.73/year** while it remains active. This is incremental to the primary Supabase plan. A separate Vercel staging project has no separate base charge when it lives in the same paid Vercel team, but Vercel usage can add overages.
- **Administrator access:** Vercel and Supabase administrators; Microsoft administrator for test integrations.
- **If omitted:** production capacity remains unqualified. The conservative current local result is 10 public VUs within thresholds; 25 breached p95 on the remediation rerun.
- **Verification:** record p50/p95/p99, errors, DB pool/CPU/RAM, Realtime clients, storage failures, provider quotas, and recovery after stop; update `CAPACITY_AND_LOAD_TEST_REPORT.md`.

### 7. AI provider credentials, models, limits, and quotas — owner-confirmed

- **Status:** owner confirmed validation on 2026-07-26.
- **Follow-up:** retain provider-side monthly spend caps and 401/429 alerts; repeat the validation from isolated staging after it is provisioned.
- **Payment:** usage remains variable; see `CLIENT_COST_ESTIMATE.md` for the token-cost model.

### 8. Approve certificate legal identity

- **Exact action:** approve final certificate wording, signatory names/titles, and an official seal/signature asset if required.
- **Why:** source code must not invent legal or organisational attestations.
- **Where:** programme/legal governance, then provide approved assets through the normal secure content process.
- **Value/decision needed:** exact bilingual wording and approved identity assets.
- **Payment:** possible legal/design cost; no infrastructure cost assumed.
- **Administrator access:** programme owner/legal approver.
- **If omitted:** the implemented certificate remains technically functional with its current non-fabricated programme identity, but cannot be represented as legally approved.
- **Verification:** owner signs off both EN/FR generated PDFs and a long-name sample.

### 9. Production dependency advisories — remediated

- **Status:** remediated on 2026-07-26. No owner decision or risk acceptance is required.
- **Action completed:** upgraded Next.js, `eslint-config-next`, and `@next/env` to 16.2.12 and pinned the patched PostCSS 8.5.23 and Sharp 0.35.0 dependency paths with supported npm overrides.
- **Why:** the repaired GitHub Security workflow now creates and runs its jobs; the prior three high-severity production advisories were in Next.js' bundled PostCSS/Sharp dependency chain.
- **Verification:** `npm audit --omit=dev --audit-level=high` reports **0 vulnerabilities**. The Security workflow is expected to pass after this change reaches `main`.

## Recommended but not blocking

### 10. Configure production observability and capacity alerts

- **Action:** alert at 70% of usable DB connections, Realtime quota, storage quota, AI/provider rate limits, function duration, and error budget; capture Core Web Vitals.
- **Where:** Supabase reports, Vercel/Sentry/Analytics, and provider dashboards.
- **Payment/admin:** paid plan features may be required; infrastructure administrator required.
- **If omitted:** failures are detected later and capacity estimates remain harder to refine.
- **Verification:** trigger each alert safely in staging and document the on-call owner.

### 11. Review Vercel and Supabase plans before expanding beyond the pilot

- **Action:** record Vercel Fluid Compute/memory/spend settings and Supabase compute, pooler-client, Realtime, storage, backup, and egress limits.
- **Why:** connection and provider telemetry—not registered-account count—set the real active-user envelope.
- **Payment/admin:** upgrades may cost money; owner approval and platform administration required.
- **If omitted:** keep the conservative pilot limit and do not advertise a higher capacity.
- **Verification:** attach plan screenshots/exports without secrets to the capacity evidence and rerun staging load.

### 12. Schedule periodic recovery and accessibility certification

- **Action:** add a release-candidate exercise for offline/reconnect, multiple tabs, 200% zoom, keyboard-only navigation, screen reader checks, contrast, and an axe/pa11y scan.
- **Where:** isolated staging and the organisation's accessibility QA process.
- **Payment/admin:** specialist review or tooling may cost money; no tenant administrator is inherently required.
- **If omitted:** current semantic/viewport smoke remains useful but is not formal WCAG certification.
- **Verification:** retain issue-level evidence and a signed accessibility report.
