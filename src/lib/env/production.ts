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
