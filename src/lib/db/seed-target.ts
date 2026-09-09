const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export const SEED_REMOTE_OVERRIDE = 'SEED_ALLOW_REMOTE';

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
  target: string;
  reason: string;
}

export function evaluateSeedTarget(
  databaseUrl: string | undefined,
  override: string | undefined,
): SeedTargetDecision {
  const target = describeDatabaseTarget(databaseUrl);

  if (!target) {
    return {
      allowed: false,
      target: '(unparseable DATABASE_URL)',
      reason: databaseUrl ? 'DATABASE_URL is invalid.' : 'DATABASE_URL is not set.',
    };
  }

  if (isLocalDatabaseUrl(databaseUrl)) {
    return { allowed: true, target, reason: '' };
  }

  const allowedTarget = override?.trim();
  if (allowedTarget === 'true') {
    return { allowed: true, target, reason: '' };
  }

  if (allowedTarget) {
    if (allowedTarget === target) {
      return { allowed: true, target, reason: '' };
    }
    return {
      allowed: false,
      target,
      reason:
        `Refusing to seed ${target}.\n\n` +
        `${SEED_REMOTE_OVERRIDE} pins seeding to "${allowedTarget}", and this is a ` +
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
