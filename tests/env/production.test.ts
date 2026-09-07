import { describe, expect, it } from 'vitest';
import { assertProductionEnvironment, assertSeedAllowed } from '@/lib/env/production';

const validProductionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  DATABASE_URL: 'postgresql://user:secret@db.internal/app',
  DIRECT_URL: 'postgresql://user:secret@db-direct.internal/app',
  AUTH_SECRET: 'a-secure-auth-secret-that-is-long-enough',
  AUTH_URL: 'https://portal.company.test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_real-key',
  SUPABASE_SECRET_KEY: 'sb_secret_real-key',
  SUPABASE_STORAGE_BUCKET: 'portal-files',
  STORAGE_PROVIDER: 'supabase',
  CRON_SECRET: 'a-secure-cron-secret-that-is-long-enough',
  SENTRY_DSN: 'https://public@sentry.io/1',
  NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.io/1',
  UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'redis-real-token',
  MAIL_GRAPH_TENANT_ID: 'tenant-real-id',
  MAIL_GRAPH_CLIENT_ID: 'client-real-id',
  MAIL_GRAPH_CLIENT_SECRET: 'client-real-secret',
  MAIL_GRAPH_SENDER: 'portal@company.test',
};

describe('production environment validation', () => {
  it('does nothing outside production', () => {
    expect(() => assertProductionEnvironment({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('accepts a fully configured production environment', () => {
    expect(() => assertProductionEnvironment(validProductionEnv)).not.toThrow();
  });

  it('rejects missing operational dependencies in production', () => {
    const env = { ...validProductionEnv };
    delete env.UPSTASH_REDIS_REST_TOKEN;
    expect(() => assertProductionEnvironment(env)).toThrow(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it('rejects placeholder and non-HTTPS production values', () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        AUTH_SECRET: 'replace-with-a-32-byte-placeholder-secret',
        AUTH_URL: 'http://localhost:3000',
      }),
    ).toThrow(/AUTH_SECRET|AUTH_URL/);
  });
});

describe('seed guard', () => {
  const validSeedEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    SEED_SUPER_ADMIN_EMAIL: 'Admin@Company.test',
    SEED_DEFAULT_PASSWORD: 'a-deliberate-seed-password',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/app',
  };

  const remoteUrl = 'postgresql://postgres.projectref:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';
  const otherProjectUrl = 'postgresql://postgres.otherref:pw@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

  it('allows a development seed and normalises the admin email', () => {
    expect(assertSeedAllowed(validSeedEnv)).toEqual({
      superAdminEmail: 'admin@company.test',
      defaultPassword: 'a-deliberate-seed-password',
    });
  });

  it('refuses to seed a production runtime', () => {
    expect(() => assertSeedAllowed({ ...validSeedEnv, NODE_ENV: 'production' })).toThrow(
      /production environment/,
    );
    expect(() => assertSeedAllowed({ ...validSeedEnv, VERCEL_ENV: 'production' })).toThrow(
      /production environment/,
    );
  });

  it('allows a deliberate production seed via the documented escape hatch', () => {
    expect(() =>
      assertSeedAllowed({
        ...validSeedEnv,
        VERCEL_ENV: 'production',
        ALLOW_PRODUCTION_SEED: 'true',
      }),
    ).not.toThrow();
  });

  // The likeliest accident: a laptop with NODE_ENV unset pointed at a real
  // database. Only the absence of a fallback credential stops it.
  it('refuses to seed when either credential is unset, even outside production', () => {
    const { SEED_DEFAULT_PASSWORD: _pw, ...noPassword } = validSeedEnv;
    expect(() => assertSeedAllowed(noPassword)).toThrow(/SEED_DEFAULT_PASSWORD/);

    const { SEED_SUPER_ADMIN_EMAIL: _em, ...noEmail } = validSeedEnv;
    expect(() => assertSeedAllowed(noEmail)).toThrow(/SEED_SUPER_ADMIN_EMAIL/);

    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).toThrow(
      /SEED_SUPER_ADMIN_EMAIL and SEED_DEFAULT_PASSWORD/,
    );
  });

  it('seeds a local database without an explicit database pin', () => {
    expect(() => assertSeedAllowed(validSeedEnv)).not.toThrow();
  });

  it('refuses a remote database that is not explicitly named', () => {
    expect(() => assertSeedAllowed({ ...validSeedEnv, DATABASE_URL: remoteUrl })).toThrow(
      /SEED_ALLOW_DATABASE/,
    );
  });

  it('seeds a remote database once it is named', () => {
    expect(() =>
      assertSeedAllowed({
        ...validSeedEnv,
        DATABASE_URL: remoteUrl,
        SEED_ALLOW_DATABASE: 'postgres.projectref@aws-1-eu-central-1.pooler.supabase.com',
      }),
    ).not.toThrow();
  });

  // Two Supabase projects share a regional pooler hostname, so a host-only
  // comparison would wave this through. The project ref lives in the username.
  it('re-locks when DATABASE_URL is repointed at a different project on the same host', () => {
    expect(() =>
      assertSeedAllowed({
        ...validSeedEnv,
        DATABASE_URL: otherProjectUrl,
        SEED_ALLOW_DATABASE: 'postgres.projectref@aws-1-eu-central-1.pooler.supabase.com',
      }),
    ).toThrow(/postgres\.otherref@/);
  });
});
