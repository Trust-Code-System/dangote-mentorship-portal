# Production launch — 17 November 2026

Canonical application: https://kennedia.blakmoh.com

## Account cleanup

The owner requested keeping Paul and BLAK MOH and removing the other demo accounts.
The operational Super Admin is also retained so programme administration remains available.

Applied to Supabase project `whgzjjjiruhluqxjjacy`, schema `mentorship`:

- 45 original July seed users archived and deactivated, with their role grants and profiles.
- Associated demo matches, goals, meetings, session logs, responses, notifications and other personal demo records soft-deleted.
- No passwords, participant files, programme definitions, form templates or shared resources changed.
- Paul and BLAK MOH remain active with their original profiles and accepted pairing in the 2026/2027 stream.
- Verification: three active accounts, one active mentor profile, one active mentee profile, one accepted pairing, zero active seeded demo participants.

Audit action: `production.demo_archived`.
Audit/run ID: `fa1bbc4b-bb7e-4cdd-959e-35cb6c5c3d22`.
Archive timestamp: `2026-11-17T06:16:51.428Z`.

`scripts/archive-seeded-demo.mjs` defaults to a read-only plan. Applying requires
both `--apply` and a matching `ARCHIVE_CONFIRM_TARGET`. It verifies the target,
the two preserved accounts, the operational administrator, the original 45 seed
accounts, their role/cohort scope and absence of real-user pairings. The write
uses one serializable transaction and records the changed IDs in the audit log.

Recovery is scoped to `metadata.rowIds` in that audit record: restore
`deleted_at = NULL` only where it still equals the recorded archive timestamp;
restore users' `is_active` from `metadata.usersBefore`. Do not reset passwords,
restore unrelated records, or rerun the demo seed. Content and files remain intact.

## Release safeguards

- Includes the pending shared Redis expiry repair from PR #74, retaining the existing sign-in throttle message.
- `npm run build` runs `npm run release:check` before Next.js compilation.
- The check runs only for a production environment. Ordinary CI/preview builds skip live provider access.
- It verifies matching runtime/migration database targets, the selected database schema and all migration checksums, accepting equivalent Windows/Linux line endings.
- It verifies a private Storage bucket using a signed browser upload and server download, rejects anonymous downloads, and removes only that synthetic probe.
- It pings the configured shared Redis store and authenticates to the approved SMTP provider with TLS. It sends no email.
- Credentials remain inside the Vercel build environment; provider error bodies and secrets are not printed.
- Vercel Node version is aligned to the repository's Node 22 requirement. Production mail explicitly selects SMTP.

The database uses project `whgzjjjiruhluqxjjacy` and private file Storage uses
`owkgqglwvjlaizsfpuir`. Storage is provider-independent in this app; these projects
do not need to be identical. The initial staged candidate stopped because the
new preflight incorrectly assumed they must match. The check was corrected to
compare runtime/migration database targets and verify Storage independently;
no data or files were moved and that failed candidate was not promoted.

## Verification and remaining operations

Release source `c3eee69` passed all eight GitHub checks, including the browser
test that persists signatures, goal approvals, goal stages and action completion
and verifies the displayed progress. Production dependency audit: zero high
or critical vulnerabilities; five moderate transitive Sentry/glob/minimatch
advisories remain. The 19 database migration checksums match this source.

The release must be staged using production environment variables and its
service check must pass before promotion. Check `/`, `/api/health`, protected
routes, public security headers, cron authentication and runtime errors after
promotion. Keep the preceding production deployment as the rollback target.

Rollback deployment before this release: `dpl_3pT9P2LBZtqpEycL1yAMBvsba59c`.
The owner restored Storage project `owkgqglwvjlaizsfpuir`; all production service
checks subsequently passed. The approved email was accepted once by SMTP;
subsequent staged builds skipped it, preserving the once-only audit reservation.

Final follow-up repairs retain a partially delivered newsletter as scheduled so
failed recipients can be retried without resending to recipients already marked
delivered. An empty audience is not reported as a successful send. The public
contact page now points to the existing private support workflow in English and
French instead of showing an implementation placeholder.
The request-access page also uses that guidance instead of a demo mailbox.

The retained operational administrator was found using the public demo password.
It was replaced with a cryptographically generated password, verified against
the saved hash, and recorded as `production.admin_password_rotated`. The access
details are stored in an owner-only local file outside this repository; no
credential was printed, emailed or committed. Production `AUTH_SECRET` is
rotated for the release to invalidate existing sessions. Participant passwords
are preserved.

AI and Microsoft integrations remain disabled. AI activation needs commercial
approval and explicit backend allowances. Newsletters are all drafts, with no
approval or enabled draft schedule; none is queued for automatic delivery.

GitHub main requires an independent approval and required CI checks. Do not
bypass those protections or claim main has been merged without evidence.

The owner also approved one test email to the existing BLAK MOH account, with
subject "Mentorship portal production check" and the exact informational message
shown in the chat. Only a production build given `SEND_APPROVED_LAUNCH_TEST=true`
can attempt it. A durable audit reservation (`launch-mail-2026-11-17`) prevents
another attempt on a repeated build; credentials and the address are not logged.
SMTP acceptance is not proof of inbox receipt. Backup/PITR retention,
a restore drill and external alert routing still need verification in the
correct Supabase/Sentry accounts; the connected Supabase account does not list
this project's infrastructure. No paid upgrades are authorized by this record.
