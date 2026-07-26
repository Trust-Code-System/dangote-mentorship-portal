import { prisma } from '../src/lib/db/prisma';

type SettingRow = { value: string };
type ActivityRow = { total: bigint; active: bigint; idle: bigint };
type DatabaseStatsRow = {
  connections: bigint;
  commits: bigint;
  rollbacks: bigint;
  blocksRead: bigint;
  blocksHit: bigint;
  tempFiles: bigint;
  deadlocks: bigint;
  databaseBytes: bigint;
};

function numeric(value: bigint | number): number {
  return Number(value);
}

async function main() {
  const [version, maxConnections, activity, stats] = await Promise.all([
    prisma.$queryRaw<
      SettingRow[]
    >`SELECT current_setting('server_version') AS value`,
    prisma.$queryRaw<
      SettingRow[]
    >`SELECT current_setting('max_connections') AS value`,
    prisma.$queryRaw<ActivityRow[]>`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE state = 'active')::bigint AS active,
        COUNT(*) FILTER (WHERE state = 'idle')::bigint AS idle
      FROM pg_stat_activity
    `,
    prisma.$queryRaw<DatabaseStatsRow[]>`
      SELECT
        numbackends::bigint AS connections,
        xact_commit::bigint AS commits,
        xact_rollback::bigint AS rollbacks,
        blks_read::bigint AS "blocksRead",
        blks_hit::bigint AS "blocksHit",
        temp_files::bigint AS "tempFiles",
        deadlocks::bigint AS deadlocks,
        pg_database_size(current_database())::bigint AS "databaseBytes"
      FROM pg_stat_database
      WHERE datname = current_database()
    `,
  ]);

  const activityRow = activity[0];
  const statsRow = stats[0];
  if (!activityRow || !statsRow)
    throw new Error('Database capacity metrics were unavailable.');

  const blocks = numeric(statsRow.blocksRead) + numeric(statsRow.blocksHit);
  const safe = {
    capturedAt: new Date().toISOString(),
    postgresVersion: version[0]?.value ?? 'unknown',
    maxConnections: Number(maxConnections[0]?.value ?? 0),
    observedConnections: {
      total: numeric(activityRow.total),
      active: numeric(activityRow.active),
      idle: numeric(activityRow.idle),
      database: numeric(statsRow.connections),
    },
    cumulativeDatabaseStats: {
      commits: numeric(statsRow.commits),
      rollbacks: numeric(statsRow.rollbacks),
      cacheHitRatio: blocks === 0 ? null : numeric(statsRow.blocksHit) / blocks,
      tempFiles: numeric(statsRow.tempFiles),
      deadlocks: numeric(statsRow.deadlocks),
      databaseBytes: numeric(statsRow.databaseBytes),
    },
    note: 'Read-only snapshot. Provider plan, CPU, RAM and pool saturation require provider telemetry.',
  };

  console.log(JSON.stringify(safe, null, 2));
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Capacity probe failed.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
