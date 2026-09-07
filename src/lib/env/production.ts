import { z } from 'zod';

const nonPlaceholder = z
  .string()
  .min(1)
  .refine(
    (value) => !/replace|changeme|placeholder|localhost|example/i.test(value),
    'must not contain a development or placeholder value',
  );

const productionEnvSchema = z.object({
  DATABASE_URL: nonPlaceholder,
  DIRECT_URL: nonPlaceholder,
  AUTH_SECRET: nonPlaceholder.min(32),
  AUTH_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith('https://'), 'must use HTTPS'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonPlaceholder,
  SUPABASE_SECRET_KEY: nonPlaceholder,
  SUPABASE_STORAGE_BUCKET: nonPlaceholder,
  STORAGE_PROVIDER: z.literal('supabase'),
  CRON_SECRET: nonPlaceholder.min(32),
  SENTRY_DSN: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: nonPlaceholder,
});

export function assertProductionEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.VERCEL_ENV !== 'production' && env.REQUIRE_PRODUCTION_ENV !== 'true') return;

  const parsed = productionEnvSchema.safeParse(env);
  if (parsed.success) return;

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid production environment: ${details}`);
}

// ---------------------------------------------------------------------------
// Seed guard
// ---------------------------------------------------------------------------

/** Credentials the demo seed will provision accounts with. */
export interface SeedCredentials {
  superAdminEmail: string;
  defaultPassword: string;
}

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Identity of the database a connection string points at, as `user@host`. For
 * Supabase the username carries the project ref (`postgres.<ref>`), so two
 * projects behind the same regional pooler host are still distinguishable —
 * which a bare hostname comparison would miss.
 */
function databaseIdentity(url: string | undefined): { value: string; isLocal: boolean } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      value: `${parsed.username}@${parsed.hostname}`,
      isLocal: LOCAL_DB_HOSTS.has(parsed.hostname),
    };
  } catch {
    return null;
  }
}

/**
 * Gate for `npm run db:seed`. The seed provisions a Super Admin plus ~45 demo
 * mentor/mentee accounts that all share one password, so running it against a
 * real deployment creates a fleet of live, known-credential logins. It is a
 * development tool and must never run against production.
 *
 * Three conditions have to hold:
 *
 *  1. The environment must not declare itself production. Catches a seed invoked
 *     from CI or a deployed runtime. `ALLOW_PRODUCTION_SEED=true` overrides it
 *     for a deliberately throwaway environment.
 *  2. Both seed credentials must be set explicitly — there are deliberately no
 *     hardcoded fallbacks, so a demo password can never reach a database by
 *     default.
 *  3. A remote DATABASE_URL must be named in SEED_ALLOW_DATABASE. This is the
 *     one that protects a developer machine, where NODE_ENV is unset and (2)
 *     gives no protection at all, because Prisma auto-loads .env back into
 *     process.env at client construction — the guard sees whatever .env says.
 *     Only pinning the identity survives that.
 */
export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env): SeedCredentials {
  const isProduction = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
  if (isProduction && env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error(
      'Refusing to seed: this is a production environment. The seed creates demo ' +
        'accounts that share a single password. Set ALLOW_PRODUCTION_SEED=true only ' +
        'if you are deliberately seeding a throwaway environment.',
    );
  }

  // Pin the seed to one specific database. This is the check that actually
  // protects a developer machine: NODE_ENV is unset there, and requiring the
  // credentials to be set does NOT help, because Prisma auto-loads .env back
  // into process.env when the client is constructed — so whatever .env says is
  // what the guard sees. Repointing DATABASE_URL at another deployment changes
  // this identity and re-locks the seed until the operator consciously updates
  // SEED_ALLOW_DATABASE too.
  const identity = databaseIdentity(env.DATABASE_URL);
  if (identity && !identity.isLocal && env.SEED_ALLOW_DATABASE !== identity.value) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at the remote database "${identity.value}", ` +
        'which is not the one this environment is allowed to seed. If that is genuinely ' +
        `the target, set SEED_ALLOW_DATABASE="${identity.value}".`,
    );
  }

  const superAdminEmail = env.SEED_SUPER_ADMIN_EMAIL?.trim();
  const defaultPassword = env.SEED_DEFAULT_PASSWORD;

  const missing = [
    superAdminEmail ? null : 'SEED_SUPER_ADMIN_EMAIL',
    defaultPassword ? null : 'SEED_DEFAULT_PASSWORD',
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new Error(
      `Refusing to seed: ${missing.join(' and ')} must be set explicitly. ` +
        'There is no default — a fallback credential is how demo logins reach a real ' +
        'database. See .env.example.',
    );
  }

  return {
    superAdminEmail: superAdminEmail!.toLowerCase(),
    defaultPassword: defaultPassword!,
  };
}
