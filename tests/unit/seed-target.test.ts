import { describe, expect, it } from 'vitest';
import {
  SEED_REMOTE_OVERRIDE,
  describeDatabaseTarget,
  evaluateSeedTarget,
  isLocalDatabaseUrl,
} from '@/lib/db/seed-target';

// This guard exists because a seed run reached the live Supabase instance and
// created two overdue assessment windows. The property that matters is that it
// fails CLOSED: anything not demonstrably local is refused.

const LOCAL = 'postgresql://user:pw@localhost:5432/portal';
const REMOTE = 'postgresql://user:pw@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

describe('isLocalDatabaseUrl', () => {
  it('accepts localhost and loopback addresses', () => {
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0']) {
      expect(isLocalDatabaseUrl(`postgresql://u:p@${host}:5432/db`)).toBe(true);
    }
  });

  it('is case-insensitive about the hostname', () => {
    expect(isLocalDatabaseUrl('postgresql://u:p@LOCALHOST:5432/db')).toBe(true);
  });

  it('rejects a managed/remote host', () => {
    expect(isLocalDatabaseUrl(REMOTE)).toBe(false);
  });

  it('rejects a host that merely contains "localhost"', () => {
    expect(isLocalDatabaseUrl('postgresql://u:p@localhost.evil.com:5432/db')).toBe(false);
  });

  it('fails closed on undefined and on garbage', () => {
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl('')).toBe(false);
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
  });
});

describe('describeDatabaseTarget', () => {
  it('reports host, port and database', () => {
    expect(describeDatabaseTarget(LOCAL)).toBe('localhost:5432/portal');
  });

  it('never leaks credentials', () => {
    const described = describeDatabaseTarget('postgresql://admin:sup3rsecret@db.example.com:5432/app');
    expect(described).toBe('db.example.com:5432/app');
    expect(described).not.toContain('sup3rsecret');
    expect(described).not.toContain('admin');
  });

  it('returns null for something unparseable', () => {
    expect(describeDatabaseTarget('nonsense')).toBeNull();
    expect(describeDatabaseTarget(undefined)).toBeNull();
  });
});

describe('evaluateSeedTarget', () => {
  it('allows a local database with no override', () => {
    const decision = evaluateSeedTarget(LOCAL, false);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('');
  });

  it('refuses a remote database', () => {
    const decision = evaluateSeedTarget(REMOTE, false);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Refusing to seed a non-local database');
  });

  it('names the refused target so the mistake is obvious', () => {
    const decision = evaluateSeedTarget(REMOTE, false);
    expect(decision.target).toBe('aws-1-eu-central-1.pooler.supabase.com:5432/postgres');
    expect(decision.reason).toContain(decision.target);
  });

  it('tells the operator how to override deliberately', () => {
    expect(evaluateSeedTarget(REMOTE, false).reason).toContain(SEED_REMOTE_OVERRIDE);
  });

  it('allows a remote database when the override is set', () => {
    expect(evaluateSeedTarget(REMOTE, true).allowed).toBe(true);
  });

  it('refuses a missing DATABASE_URL', () => {
    const decision = evaluateSeedTarget(undefined, false);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('DATABASE_URL is not set');
  });

  it('refuses an unparseable URL even with the override unset', () => {
    expect(evaluateSeedTarget('not a url', false).allowed).toBe(false);
  });

  it('warns about what the seed actually does, not just that it refused', () => {
    const reason = evaluateSeedTarget(REMOTE, false).reason;
    expect(reason).toMatch(/one password/i);
    expect(reason).toMatch(/lock accounts out/i);
  });
});

describe('pinned seed target', () => {
  const neon = 'postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb';
  const supabase = 'postgresql://postgres.ref:p@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

  it('still unlocks any remote when the override is literally true', () => {
    expect(evaluateSeedTarget(neon, true).allowed).toBe(true);
    expect(evaluateSeedTarget(neon, 'true').allowed).toBe(true);
    expect(evaluateSeedTarget(supabase, true).allowed).toBe(true);
  });

  it('allows the pinned database', () => {
    const target = describeDatabaseTarget(neon)!;
    expect(evaluateSeedTarget(neon, target).allowed).toBe(true);
  });

  // The reason the pin exists: when the TEST database is itself remote, the
  // boolean override must stay on permanently, and then it no longer protects
  // production. A pin re-locks the moment DATABASE_URL changes.
  it('refuses a different database even though the override is set', () => {
    const pinnedToNeon = describeDatabaseTarget(neon)!;
    const decision = evaluateSeedTarget(supabase, pinnedToNeon);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/pins seeding to/);
  });

  it('still refuses a remote with no override at all', () => {
    expect(evaluateSeedTarget(neon, undefined).allowed).toBe(false);
    expect(evaluateSeedTarget(neon, '').allowed).toBe(false);
  });
});
