// Migration drift detection.
//
// Vercel builds run `next build` only — never `prisma migrate deploy` — so a
// database's schema advances only when a human remembers to run it. Production
// drifted exactly this way: two migrations were never applied, and nothing in
// the build, the test suite or `/api/health` noticed, because a missing *column*
// still leaves a healthy-looking table and `SELECT 1` still answers.
//
// The evaluator below is pure (no I/O) so it can be unit-tested against golden
// cases; `scripts/check-migration-drift.ts` supplies the two inputs.
//
// The subtle case this exists to catch: a row in `_prisma_migrations` with
// `finished_at = NULL` is how Prisma records a migration that *started and
// failed*. Prisma then refuses to run `migrate deploy` at all until it is
// resolved — so one failed row silently freezes every later migration.

export interface AppliedMigration {
  migrationName: string;
  /** NULL means the migration started and never completed — Prisma treats this as failed. */
  finishedAt: Date | null;
  rolledBackAt: Date | null;
}

export interface MigrationDrift {
  inSync: boolean;
  /** In the repo, with no successfully-applied row. */
  pending: string[];
  /** Recorded but unfinished — blocks `prisma migrate deploy` until resolved. */
  failed: string[];
  rolledBack: string[];
  /** Applied to the database but absent from the repo (e.g. a reverted branch). */
  unknown: string[];
  /** Recorded more than once. A hand-written `migrate resolve` can cause this. */
  duplicates: string[];
  summary: string;
}

function succeeded(row: AppliedMigration): boolean {
  return row.finishedAt !== null && row.rolledBackAt === null;
}

function sortedUnique(names: Iterable<string>): string[] {
  return [...new Set(names)].sort();
}

/**
 * Compares the migrations present in the repo against the rows recorded in the
 * database. `repoMigrations` is the list of directory names under
 * `prisma/migrations` (excluding `migration_lock.toml`).
 */
export function evaluateMigrationDrift(
  repoMigrations: string[],
  applied: AppliedMigration[],
): MigrationDrift {
  const repo = new Set(repoMigrations);

  const seen = new Map<string, number>();
  for (const row of applied) {
    seen.set(row.migrationName, (seen.get(row.migrationName) ?? 0) + 1);
  }

  const succeededNames = new Set(applied.filter(succeeded).map((r) => r.migrationName));

  const pending = sortedUnique(repoMigrations.filter((name) => !succeededNames.has(name)));
  const failed = sortedUnique(
    applied.filter((r) => r.finishedAt === null && r.rolledBackAt === null).map((r) => r.migrationName),
  );
  const rolledBack = sortedUnique(
    applied.filter((r) => r.rolledBackAt !== null).map((r) => r.migrationName),
  );
  const unknown = sortedUnique(
    applied.map((r) => r.migrationName).filter((name) => !repo.has(name)),
  );
  const duplicates = sortedUnique(
    [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name),
  );

  const inSync =
    pending.length === 0 &&
    failed.length === 0 &&
    rolledBack.length === 0 &&
    unknown.length === 0 &&
    duplicates.length === 0;

  const parts: string[] = [];
  if (pending.length) parts.push(`${pending.length} pending`);
  if (failed.length) parts.push(`${failed.length} failed`);
  if (rolledBack.length) parts.push(`${rolledBack.length} rolled back`);
  if (unknown.length) parts.push(`${unknown.length} unknown`);
  if (duplicates.length) parts.push(`${duplicates.length} duplicated`);

  const summary = inSync
    ? `In sync: ${repoMigrations.length} migration(s) applied.`
    : `Drift detected: ${parts.join(', ')}.`;

  return { inSync, pending, failed, rolledBack, unknown, duplicates, summary };
}

/** Human-readable report lines, safe to log (no credentials, no data). */
export function migrationDriftLines(drift: MigrationDrift): string[] {
  const lines = [drift.summary];

  if (drift.failed.length) {
    lines.push(
      `  failed (blocks "prisma migrate deploy" until resolved): ${drift.failed.join(', ')}`,
    );
  }
  if (drift.pending.length) {
    lines.push(`  pending (in repo, not applied): ${drift.pending.join(', ')}`);
  }
  if (drift.rolledBack.length) {
    lines.push(`  rolled back: ${drift.rolledBack.join(', ')}`);
  }
  if (drift.unknown.length) {
    lines.push(`  applied but not in this repo: ${drift.unknown.join(', ')}`);
  }
  if (drift.duplicates.length) {
    lines.push(`  recorded more than once: ${drift.duplicates.join(', ')}`);
  }
  return lines;
}
