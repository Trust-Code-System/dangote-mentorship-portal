# Production operations and recovery

The portal is hosted at https://kennedia.blakmoh.com. AI and Microsoft
integrations remain disabled. Only the two preserved participant accounts remain
active; the existing mentor account also holds the global administrator grant.
The legacy demo administrator is archived. The handover is recorded as
`production.admin_handover`; participant passwords and pair records are preserved.

## Newsletter approval

Administrators use `/admin/newsletters` to create and edit an issue. Save the
subject and content, review the preview, then approve the issue. Approval records
the administrator and enables sending. An edit withdraws approval and returns
the issue to draft. Scheduled dispatch only selects approved issues whose send
time has arrived; draft-preparation schedules never approve content themselves.

Partial delivery remains scheduled so failed recipients can be retried. Rows
already stamped delivered are skipped. An empty audience is not marked sent.
`tests/newsletters/send.test.ts` covers rejection before approval and delivery
recovery. `tests/e2e/newsletter-approval.spec.ts` verifies actual browser approval,
persisted edits and approval withdrawal in disposable CI Postgres; it sends no
participant email. No production draft is approved or dispatched by these checks.

## Dependency fixes

Sentry's bundler dependency is constrained to `glob@14.0.2`; the lockfile resolves
its matcher to patched `minimatch@11.0.9`. The current Sentry SDK and its privacy
settings are preserved. Legacy ESLint matcher dependencies retain their
compatible brace-expansion major. The production audit gate now rejects moderate
as well as high/critical advisories. Development-tool advisories are a separate
dependency set and must not be described as production vulnerabilities.

References: https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 and
https://github.com/advisories/GHSA-g3hv-75wg-m249.

## Database recovery drill

`scripts/backup-restore-drill.mjs` is an operator command, run with the verified
production connection variables available to the process. It refuses any
database other than `whgzjjjiruhluqxjjacy/mentorship`. It does not seed, migrate or
restore a hosted database. It exports only the application schema, including
archived records; unrelated public-schema data is excluded.

The command uses an exported repeatable-read, read-only snapshot for both table
fingerprints and `pg_dump`. The pinned official PostgreSQL 17 Docker image uses
`verify-full` TLS with the public CA obtained from Supabase's dashboard. The CA
certificate is bundled at `scripts/certs/supabase-prod-ca-2021.crt`, fingerprint
`807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`.

The snapshot is encrypted with AES-256-GCM, read back and decrypted, then restored
into a disposable local PostgreSQL container with networking disabled. Every
restored table's row count and digest must match the same source snapshot.
Plaintext dump files and the disposable restore container are removed.

On 17 November 2026, all **63 tables** matched; the isolated restore and
verification phase took **20 seconds**. The encrypted archive, key and private
verification manifest are outside Git under the Windows owner's
`.codex/private/mentorship-backups` directory, with owner-only file permissions.
Keep the recovery key separately in a protected off-site/password-manager
location. A key stored only on the same computer is not disaster recovery.

## Uploaded-file recovery

A database backup contains file references, not Storage object bytes. Storage
uses the separate private project `owkgqglwvjlaizsfpuir`, bucket `portal-files`.

`scripts/export-storage-backup.ts` runs only during an explicitly flagged staged
production build (`EXPORT_APPROVED_STORAGE_BACKUP=true`). It also requires a
unique `RECOVERY_EXPORT_ID` and an RSA public key of at least 3072 bits in
`RECOVERY_PUBLIC_KEY_B64`. The private key stays on the owner's computer.

The exporter inventories and downloads source files, checks sizes, hashes every
object and verifies that the inventory did not change during the export. It
compresses and encrypts the archive with AES-256-GCM, wraps the key with
RSA-OAEP-SHA256 and writes only the encrypted envelope to the private
`recovery-exports` prefix. Source files are unchanged. Exports and release probes
are excluded from future source inventories. This bounded workflow refuses
snapshots over 32 MiB; larger datasets need a streaming backup tool.

Download the matching encrypted envelope through the owning Supabase dashboard.
Run `scripts/verify-storage-recovery.mjs` with the downloaded file path and the
owner-private backup directory. It verifies the envelope and key, decrypts it,
restores each file into a fresh isolated local directory, verifies every file's
size/hash, saves the encrypted archive and verification report, then removes the
plaintext restore copy. It rejects duplicate or escaping paths and never writes
to hosted objects.

The staged export on 17 November contained **2 original objects / 20,814 bytes**.
Local restore verification is recorded separately in `storage-verification.json`.
No private archive, recovery key, participant file or database dump belongs in
this repository or a public CI artifact.

## Error alerts

The live browser configuration maps to Sentry project `4511350094889040`,
`javascript-nextjs`, in the existing `atlas-hr` organization. The error monitor is
`1160370`; the project email alert is `541103`. The alert was changed from the
automatic suggested-assignee/fallback route to the explicit existing account
owner. Issue-alert email was globally off in that account; a project-only `On`
override was added for `javascript-nextjs`, preserving other projects' settings.
A subsequent test reported `Notification fired!`, and its `Test Issue` email was
verified in the account owner's Gmail inbox on 17 November at 09:22 Lagos time.

Sentry exposed an invitation-activation failure: the audit insert used the global
database connection before the newly created user committed. `writeAuditLog`
now accepts the active transaction client. Invite acceptance and password reset
write their audit records in that same transaction. The fresh-invitation browser
test verifies creation, role grant, invite acceptance and the committed audit row.

## Boundaries and ongoing operations

These are verified point-in-time recovery procedures, not a managed backup
retention service. Recurring backups, an independent off-site copy and PITR
require an agreed operating policy and any necessary account/plan approval.
Supabase's Free plan does not include the paid plans' daily backup retention.
See https://supabase.com/docs/guides/platform/backups.

Source-map uploads require a Sentry upload token; runtime capture works without
one. Never paste authentication tokens or recovery keys into issue/PR bodies.
GitHub main still requires independent approval and mandatory checks. Keep the
previous live Vercel deployment as rollback evidence until the new release passes
its live checks.
