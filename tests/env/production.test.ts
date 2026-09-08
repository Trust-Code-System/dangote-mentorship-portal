import { describe, expect, it } from 'vitest';
import { assertProductionEnvironment } from '@/lib/env/production';

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
