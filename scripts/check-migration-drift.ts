/**
 * Reports whether a database's applied migrations match `prisma/migrations`.
 *
 *   npm run db:check-drift                       # whatever .env points at
 *   DATABASE_URL='postgresql://…' npm run db:check-drift   # any other database
 *
 * Read-only: it runs one SELECT against `_prisma_migrations` and writes nothing.
 * Exits 1 on drift so it can gate a release step or run in CI against a staging
 * database. It deliberately does NOT run inside the Vercel build — a migration
 * problem should surface as a loud report, not as a failed deploy.
 *
 * Why this exists: `next build` never runs `prisma migrate deploy`, so nothing
 * in the pipeline notices when a database falls behind the repo. A missing
 * *column* leaves the table present and `/api/health` (SELECT 1) green, so the
 * drift stays invisible until a page that selects that column throws.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describeDatabaseTarget } from '../src/lib/db/seed-target';
import {
  type AppliedMigration,
  evaluateMigrationDrift,
  migrationDriftLines,
} from '../src/lib/db/migration-drift';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

/** Directory names under prisma/migrations, excluding migration_lock.toml. */
function readRepoMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

async function readAppliedMigrations(prisma: PrismaClient): Promise<AppliedMigration[]> {
  const rows = await prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY started_at
  `;
  return rows.map((row) => ({
    migrationName: row.migration_name,
    finishedAt: row.finished_at,
    rolledBackAt: row.rolled_back_at,
  }));
}

async function main(): Promise<void> {
  const target = describeDatabaseTarget(process.env.DATABASE_URL);
  if (!target) {
    throw new Error('DATABASE_URL is missing or is not a valid connection string.');
  }

  const prisma = new PrismaClient();
  try {
    // Credentials are stripped by describeDatabaseTarget — safe to print.
    console.log(`Checking migrations against: ${target}\n`);

    const repo = readRepoMigrations();
    const applied = await readAppliedMigrations(prisma);
    const drift = evaluateMigrationDrift(repo, applied);

    for (const line of migrationDriftLines(drift)) console.log(line);
    console.log(`\n${repo.length} migration(s) in repo, ${applied.length} row(s) recorded.`);

    if (!drift.inSync) {
      console.log(
        '\nTo resolve: clear any failed row with `prisma migrate resolve --rolled-back <name>`, ' +
          'then run `prisma migrate deploy`.',
      );
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
