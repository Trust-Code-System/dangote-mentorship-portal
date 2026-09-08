// Guard for `npm run db:seed` (pure — no I/O, unit tested).
//
// The seed writes a whole demo cohort: 15 mentors, 30 mentees, an admin, and
// enough activity to demonstrate every feature. That is exactly right locally
// and exactly wrong against a shared or production database, where it silently
// creates real-looking users and — because the seed also generates assessment
// schedules — can lock accounts out of the portal.
//
// This has already happened once (a seed run reached the live Supabase instance
// and created two overdue assessment windows), so the seed now refuses any
// database that is not obviously local unless the operator says so explicitly.

/** Hostnames we treat as "this developer's machine". */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Env var that deliberately overrides the guard. */
export const SEED_REMOTE_OVERRIDE = 'SEED_ALLOW_REMOTE';

/**
 * The host/port/database of a Postgres URL, with credentials stripped so it is
 * safe to print in a log or an error message.
 *
 * Returns null when the URL cannot be parsed — the caller treats that as
 * "not demonstrably local", which is the fail-closed direction.
 */
export function describeDatabaseTarget(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, '') || '(default)';
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.hostname}${port}/${database}`;
  } catch {
    return null;
  }
}

/**
 * True only when the URL clearly points at a local database. Anything
 * unparseable, remote, or ambiguous is false — a guard that fails open is not a
 * guard.
 */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface SeedTargetDecision {
  allowed: boolean;
  /** Host/port/db of the target, for the operator to read. */
  target: string;
  /** Why it was refused. Empty when allowed. */
  reason: string;
}

/**
 * Decide whether the seed may run. Pure so the rule is testable without a
 * database or an environment.
 */
export function evaluateSeedTarget(
  databaseUrl: string | undefined,
  override: boolean | string | undefined,
): SeedTargetDecision {
  const target = describeDatabaseTarget(databaseUrl) ?? '(unparseable DATABASE_URL)';

  if (!databaseUrl) {
    return { allowed: false, target, reason: 'DATABASE_URL is not set.' };
  }
  if (isLocalDatabaseUrl(databaseUrl)) {
    return { allowed: true, target, reason: '' };
  }
  // `true` unlocks any remote. A target string instead pins the seed to ONE
  // database: repointing DATABASE_URL elsewhere re-locks it. That distinction
  // matters when the test database is itself remote (a hosted Neon/Supabase
  // dev instance), because then the boolean has to stay on permanently and
  // stops protecting the production database it was meant to guard.
  if (override === true || override === 'true') {
    return { allowed: true, target, reason: '' };
  }
  if (typeof override === 'string' && override.trim() !== '') {
    if (override.trim() === target) {
      return { allowed: true, target, reason: '' };
    }
    return {
      allowed: false,
      target,
      reason:
        `Refusing to seed ${target}.\n\n` +
        `${SEED_REMOTE_OVERRIDE} pins seeding to "${override.trim()}", and this is a ` +
        'different database. If you really mean to seed this one, change that value to ' +
        `"${target}".`,
    };
  }
  return {
    allowed: false,
    target,
    reason:
      `Refusing to seed a non-local database (${target}).\n\n` +
      'The seed creates a full demo cohort — dozens of users sharing one ' +
      'password, plus assessment schedules that can lock accounts out of the ' +
      'portal. That is almost never what you want against a shared or live ' +
      'database.\n\n' +
      `If you are certain, re-run with ${SEED_REMOTE_OVERRIDE}=true.`,
  };
}
