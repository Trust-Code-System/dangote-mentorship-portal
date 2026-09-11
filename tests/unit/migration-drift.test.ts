import { describe, expect, it } from 'vitest';
import {
  type AppliedMigration,
  evaluateMigrationDrift,
  migrationDriftLines,
} from '@/lib/db/migration-drift';

const AT = new Date('2026-09-08T11:42:21Z');

function ok(name: string): AppliedMigration {
  return { migrationName: name, finishedAt: AT, rolledBackAt: null };
}
function failed(name: string): AppliedMigration {
  return { migrationName: name, finishedAt: null, rolledBackAt: null };
}
function rolledBack(name: string): AppliedMigration {
  return { migrationName: name, finishedAt: AT, rolledBackAt: AT };
}

describe('evaluateMigrationDrift', () => {
  it('reports in sync when every repo migration has a successful row', () => {
    const drift = evaluateMigrationDrift(['0_init', '20260610_a'], [ok('0_init'), ok('20260610_a')]);
    expect(drift.inSync).toBe(true);
    expect(drift.pending).toEqual([]);
    expect(drift.summary).toContain('In sync');
  });

  it('treats an empty repo and empty database as in sync', () => {
    expect(evaluateMigrationDrift([], []).inSync).toBe(true);
  });

  it('flags a migration present in the repo but never applied', () => {
    const drift = evaluateMigrationDrift(['0_init', '20260907_b'], [ok('0_init')]);
    expect(drift.inSync).toBe(false);
    expect(drift.pending).toEqual(['20260907_b']);
  });

  it('flags an unfinished row as failed, since it blocks migrate deploy', () => {
    const drift = evaluateMigrationDrift(['0_init'], [failed('0_init')]);
    expect(drift.failed).toEqual(['0_init']);
    expect(drift.inSync).toBe(false);
  });

  it('counts an unfinished migration as pending as well as failed', () => {
    // It blocks deploys *and* its SQL never ran, so both lists must name it.
    const drift = evaluateMigrationDrift(['0_init'], [failed('0_init')]);
    expect(drift.pending).toEqual(['0_init']);
  });

  it('does not treat a rolled-back migration as successfully applied', () => {
    const drift = evaluateMigrationDrift(['0_init'], [rolledBack('0_init')]);
    expect(drift.rolledBack).toEqual(['0_init']);
    expect(drift.pending).toEqual(['0_init']);
    expect(drift.inSync).toBe(false);
  });

  it('flags a migration applied to the database but missing from the repo', () => {
    const drift = evaluateMigrationDrift([], [ok('20260101_gone')]);
    expect(drift.unknown).toEqual(['20260101_gone']);
    expect(drift.inSync).toBe(false);
  });

  it('flags a migration recorded more than once', () => {
    const drift = evaluateMigrationDrift(['0_init'], [ok('0_init'), ok('0_init')]);
    expect(drift.duplicates).toEqual(['0_init']);
    expect(drift.inSync).toBe(false);
  });

  it('still counts a name as applied when one row failed and a later row succeeded', () => {
    // A hand-written `migrate resolve --applied` can leave the failed row behind.
    // The SQL did eventually run, so it is not pending — but the stale failed row
    // still blocks future deploys and must be surfaced.
    const drift = evaluateMigrationDrift(['0_init'], [failed('0_init'), ok('0_init')]);
    expect(drift.pending).toEqual([]);
    expect(drift.failed).toEqual(['0_init']);
    expect(drift.duplicates).toEqual(['0_init']);
    expect(drift.inSync).toBe(false);
  });

  it('reproduces the production state observed on 2026-09-10', () => {
    // Golden case: prod had 14 distinct migrations, a duplicated
    // harden_direct_conversations (one failed row + one successful row), and the
    // two September migrations never applied.
    const repo = [
      '0_init',
      '20260726120000_harden_direct_conversations',
      '20260907120000_quarterly_assessments_reports_newsletters',
      '20260907153000_monthly_meeting_form',
      '20260907170000_engagement_report',
    ];
    const applied = [
      ok('0_init'),
      failed('20260726120000_harden_direct_conversations'),
      ok('20260726120000_harden_direct_conversations'),
      ok('20260907120000_quarterly_assessments_reports_newsletters'),
    ];

    const drift = evaluateMigrationDrift(repo, applied);

    expect(drift.inSync).toBe(false);
    expect(drift.pending).toEqual([
      '20260907153000_monthly_meeting_form',
      '20260907170000_engagement_report',
    ]);
    expect(drift.failed).toEqual(['20260726120000_harden_direct_conversations']);
    expect(drift.duplicates).toEqual(['20260726120000_harden_direct_conversations']);
    expect(drift.unknown).toEqual([]);
  });

  it('sorts and de-duplicates every reported list', () => {
    const drift = evaluateMigrationDrift(['b', 'a'], []);
    expect(drift.pending).toEqual(['a', 'b']);
  });
});

describe('migrationDriftLines', () => {
  it('returns just the summary when in sync', () => {
    const drift = evaluateMigrationDrift(['0_init'], [ok('0_init')]);
    expect(migrationDriftLines(drift)).toHaveLength(1);
  });

  it('explains that a failed row blocks migrate deploy', () => {
    const drift = evaluateMigrationDrift(['0_init'], [failed('0_init')]);
    const text = migrationDriftLines(drift).join('\n');
    expect(text).toContain('prisma migrate deploy');
    expect(text).toContain('0_init');
  });

  it('names each pending migration', () => {
    const drift = evaluateMigrationDrift(['0_init', 'b'], [ok('0_init')]);
    expect(migrationDriftLines(drift).join('\n')).toContain('b');
  });
});
