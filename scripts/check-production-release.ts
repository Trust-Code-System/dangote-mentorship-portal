import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { Redis } from '@upstash/redis';
import nodemailer from 'nodemailer';
import { assertProductionEnvironment } from '../src/lib/env/production';
import { getMailTransport } from '../src/lib/mail';
import { readSmtpMailConfig } from '../src/lib/mail/smtp';
import { getSupabaseAdmin } from '../src/lib/supabase/server';

class ReleaseCheckError extends Error {}

// Runs inside Vercel's production build, where sensitive variables stay inside
// the provider. Logs contain status only. This never seeds, migrates, sends
// email, changes permissions, or touches participant files.
async function main() {
  if (process.env.VERCEL_ENV !== 'production' && process.env.REQUIRE_PRODUCTION_ENV !== 'true') {
    console.info('[release] Production service checks skipped outside production.');
    return;
  }
  assertProductionEnvironment();
  const runtime = new URL(process.env.DATABASE_URL!);
  const direct = new URL(process.env.DIRECT_URL!);
  // Storage is deliberately provider-independent and can use a different
  // Supabase project. Only the runtime and migration database must match.
  if (
    runtime.username !== direct.username ||
    runtime.pathname !== direct.pathname ||
    runtime.searchParams.get('schema') !== direct.searchParams.get('schema')
  ) {
    throw new ReleaseCheckError('Runtime and migration database targets do not match.');
  }

  const db = new PrismaClient();
  try {
    const [database] = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
    if (database?.schema !== (runtime.searchParams.get('schema') || 'public')) {
      throw new ReleaseCheckError('The database search path does not match the configured schema.');
    }
    const applied = await db.$queryRaw<
      {
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }[]
    >`
      SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations`;
    const directories = (await readdir('prisma/migrations', { withFileTypes: true })).filter(
      (entry) => entry.isDirectory(),
    );
    for (const directory of directories) {
      const sql = await readFile(`prisma/migrations/${directory.name}/migration.sql`, 'utf8');
      // Prisma accepts equivalent line endings from Windows and Linux checkouts.
      const checksums = [sql, sql.replace(/\r\n/g, '\n'), sql.replace(/\r?\n/g, '\r\n')].map(
        (text) => createHash('sha256').update(text).digest('hex'),
      );
      const records = applied.filter(
        (row) => row.migration_name === directory.name && !row.rolled_back_at,
      );
      const record = records[0];
      if (records.length !== 1 || !record?.finished_at || !checksums.includes(record.checksum)) {
        throw new ReleaseCheckError(
          `Migration is missing, incomplete or changed: ${directory.name}`,
        );
      }
    }
    if (
      applied.some(
        (row) =>
          !row.rolled_back_at &&
          !directories.some((directory) => directory.name === row.migration_name),
      )
    ) {
      throw new ReleaseCheckError('The database contains a migration absent from this release.');
    }
    console.info(
      `[release] Database target and ${directories.length} migration checksums verified.`,
    );
  } finally {
    await db.$disconnect();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new ReleaseCheckError('Private Storage is not configured.');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
  const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(bucket);
  if (bucketError || !bucketData || bucketData.public)
    throw new ReleaseCheckError('Storage must be reachable and private.');
  const key = `release-check/${randomUUID()}.txt`;
  const contents = `Production release verification ${randomUUID()}`;
  let uploaded = false;
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(key, contents, { contentType: 'text/plain' });
    if (error) throw new ReleaseCheckError('Storage upload verification failed.');
    uploaded = true;
    const { data, error: readError } = await supabase.storage.from(bucket).download(key);
    if (readError || !data || (await data.text()) !== contents)
      throw new ReleaseCheckError('Storage download verification failed.');
  } finally {
    if (uploaded) {
      const { error } = await supabase.storage.from(bucket).remove([key]);
      if (error) throw new ReleaseCheckError('Release probe cleanup failed.');
    }
  }
  console.info('[release] Private Storage upload/download verified; probe removed.');

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  if ((await redis.ping()) !== 'PONG')
    throw new ReleaseCheckError('Shared rate-limit store is unavailable.');
  console.info('[release] Shared Redis rate-limit store reachable.');

  // SMTP is the approved programme transport. Checking the actual selector
  // prevents a stale Resend key or log fallback from silently taking precedence.
  if (getMailTransport().id !== 'smtp')
    throw new ReleaseCheckError('The approved SMTP transport is not selected.');
  const smtp = readSmtpMailConfig();
  if (!smtp.secure && !smtp.requireTLS)
    throw new ReleaseCheckError('SMTP must require encrypted transport.');
  const client = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: smtp.requireTLS,
    auth: { user: smtp.user, pass: smtp.pass },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    await client.verify();
  } catch {
    throw new ReleaseCheckError('SMTP authentication or TLS verification failed.');
  } finally {
    client.close();
  }
  console.info('[release] SMTP authentication and TLS verified; no email sent.');
  console.info('[release] Production service checks passed.');
  if (process.env.SEND_APPROVED_LAUNCH_TEST === 'true') {
    const { sendApprovedLaunchTest } = await import('./send-approved-launch-test');
    await sendApprovedLaunchTest();
  }
}

main().catch((error: unknown) => {
  // SDK/database errors may contain sensitive context; only report our own
  // controlled messages. Detailed provider diagnostics stay out of build logs.
  const message =
    error instanceof ReleaseCheckError ? error.message : 'A production service check failed.';
  console.error(`[release] ${message}`);
  process.exitCode = 1;
});
