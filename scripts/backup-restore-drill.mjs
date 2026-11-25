import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';

// Read-only production snapshot; restore is restricted to our network-isolated,
// disposable local container. No hosted restore, migration or participant mail.
const exec = promisify(execFile);
const image = 'postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7';
const magic = Buffer.from('MENTORSHIP_BACKUP_V1\n');
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-');
const directory = resolve(homedir(), '.codex', 'private', 'mentorship-backups', runId);
const container = `codex-mentorship-restore-${Date.now()}`;
const db = new PrismaClient();
let containerCreated = false;
let phase = 'target verification';
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = (table) => `SELECT count(*)::text AS rows,
  coalesce(md5(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text))), md5('')) AS digest
  FROM mentorship.${quote(table)} t`;

async function docker(args, env = {}) {
  return exec('docker', args, {
    env: { ...process.env, ...env },
    timeout: 240_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

try {
  const source = new URL(process.env.DIRECT_URL ?? '');
  const runtime = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.platform !== 'win32' ||
    source.username !== 'postgres.whgzjjjiruhluqxjjacy' ||
    source.searchParams.get('schema') !== 'mentorship' ||
    runtime.username !== source.username ||
    runtime.searchParams.get('schema') !== 'mentorship' ||
    source.port !== '5432'
  ) {
    throw new Error('Expected Windows owner workspace and confirmed production database.');
  }
  await mkdir(directory, { recursive: true });
  const identity = (await exec('whoami.exe', ['/user', '/fo', 'csv', '/nh'])).stdout;
  const sid = identity.match(/S-1-5-[0-9-]+/)?.[0];
  if (!sid) throw new Error('Cannot restrict backup directory.');
  await exec('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`]);
  await writeFile(
    join(directory, 'provider-ca.crt'),
    await readFile(new URL('./certs/supabase-prod-ca-2021.crt', import.meta.url)),
    { flag: 'wx' },
  );
  const sourceEnv = {
    PGHOST: source.hostname,
    PGPORT: source.port,
    PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
    PGUSER: decodeURIComponent(source.username),
    PGPASSWORD: decodeURIComponent(source.password),
    PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: '/backup/provider-ca.crt',
    PGCONNECT_TIMEOUT: '15',
  };
  const dumpPath = join(directory, 'snapshot.dump');
  phase = 'consistent read-only snapshot';
  console.info('[recovery] Creating a consistent read-only mentorship snapshot.');
  const manifest = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL timezone = 'UTC'");
      const [{ snapshot, version, schema }] = await tx.$queryRawUnsafe(
        "SELECT pg_export_snapshot() AS snapshot,current_setting('server_version_num') AS version,current_schema() AS schema",
      );
      if (schema !== 'mentorship' || !version.startsWith('17'))
        throw new Error('Unexpected source.');
      const tables = await tx.$queryRawUnsafe(
        "SELECT tablename FROM pg_tables WHERE schemaname='mentorship' ORDER BY tablename",
      );
      const rows = [];
      for (const { tablename } of tables) {
        const [result] = await tx.$queryRawUnsafe(fingerprint(tablename));
        rows.push({ table: tablename, ...result });
      }
      await docker(
        [
          'run',
          '--rm',
          ...Object.keys(sourceEnv).flatMap((key) => ['--env', key]),
          '--mount',
          `type=bind,source=${directory},target=/backup`,
          image,
          'pg_dump',
          '--schema=mentorship',
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          '--no-publications',
          '--no-subscriptions',
          '--lock-wait-timeout=15000',
          `--snapshot=${snapshot}`,
          '--file=/backup/snapshot.dump',
        ],
        sourceEnv,
      );
      return { version, tables: rows };
    },
    { isolationLevel: 'RepeatableRead', timeout: 300_000, maxWait: 10_000 },
  );

  phase = 'encryption and decryption';
  if ((await stat(dumpPath)).size > 512 * 1024 * 1024)
    throw new Error('Snapshot too large for this drill.');
  const plain = await readFile(dumpPath);
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const archive = join(directory, 'mentorship.dump.aes');
  const keyPath = join(directory, 'recovery.key');
  await writeFile(archive, Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]), {
    flag: 'wx',
    mode: 0o600,
  });
  await writeFile(keyPath, key, { flag: 'wx', mode: 0o600 });
  const persisted = await readFile(archive);
  if (!persisted.subarray(0, magic.length).equals(magic)) throw new Error('Invalid backup header.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    await readFile(keyPath),
    persisted.subarray(magic.length, magic.length + 12),
  );
  decipher.setAAD(magic);
  decipher.setAuthTag(persisted.subarray(magic.length + 12, magic.length + 28));
  const recovered = Buffer.concat([
    decipher.update(persisted.subarray(magic.length + 28)),
    decipher.final(),
  ]);
  if (digest(plain) !== digest(recovered)) throw new Error('Decryption checksum mismatch.');
  const recoveryPath = join(directory, 'recovered.dump');
  await writeFile(recoveryPath, recovered, { flag: 'wx', mode: 0o600 });

  phase = 'isolated restore';
  console.info('[recovery] Restoring the decrypted archive into an isolated local database.');
  const restoreStarted = Date.now();
  await docker(
    [
      'run',
      '-d',
      '--name',
      container,
      '--network=none',
      '--tmpfs',
      '/var/lib/postgresql/data',
      '--env',
      'POSTGRES_PASSWORD',
      '--env',
      'POSTGRES_DB=restore',
      image,
    ],
    { POSTGRES_PASSWORD: randomBytes(32).toString('hex') },
  );
  containerCreated = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await docker(['exec', container, 'pg_isready', '-U', 'postgres', '-d', 'restore']);
      ready = true;
      break;
    } catch {
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  if (!ready) throw new Error('Restore container did not become ready.');
  await docker(['cp', recoveryPath, `${container}:/tmp/recovered.dump`]);
  await docker([
    'exec',
    container,
    'pg_restore',
    '-U',
    'postgres',
    '-d',
    'restore',
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    '/tmp/recovered.dump',
  ]);
  phase = 'restored data verification';
  for (const expected of manifest.tables) {
    const sql =
      "SET timezone='UTC'; SELECT row_to_json(x) FROM (" + fingerprint(expected.table) + ') x';
    const { stdout } = await docker([
      'exec',
      container,
      'psql',
      '-X',
      '-qAt',
      '-U',
      'postgres',
      '-d',
      'restore',
      '-c',
      sql,
    ]);
    const actual = JSON.parse(stdout.trim());
    if (actual.rows !== expected.rows || actual.digest !== expected.digest)
      throw new Error('Restored table mismatch.');
  }
  const report = {
    verifiedAt: new Date().toISOString(),
    source: 'whgzjjjiruhluqxjjacy/mentorship',
    encrypted: 'AES-256-GCM',
    archiveSha256: digest(persisted),
    restoredFromEncryptedArchive: true,
    isolatedNetwork: true,
    restoredTables: manifest.tables.length,
    restoreSeconds: Math.round((Date.now() - restoreStarted) / 1000),
    manifest,
    scope: 'Application database schema only. Storage object bytes require a separate backup.',
  };
  await writeFile(join(directory, 'verification.json'), JSON.stringify(report, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  await writeFile(
    join(directory, 'README.txt'),
    'PRIVATE MENTORSHIP DATABASE RECOVERY BACKUP\r\n' +
      'The AES-256-GCM archive was decrypted, restored in a network-isolated local PostgreSQL 17 container, and all table fingerprints matched the same source snapshot.\r\n' +
      'Keep recovery.key separately in a protected backup/password-manager location. Losing it makes the archive unrecoverable. Never commit or email these files.\r\n' +
      'This is a point-in-time mentorship schema export, including archived records and password hashes. It excludes other projects/schemas and Storage object bytes.\r\n' +
      'Managed backup retention, off-site copies and recurring backup policy remain separate operational decisions.\r\n',
    { flag: 'wx', mode: 0o600 },
  );
  console.info(
    JSON.stringify({
      verified: true,
      backupDirectory: directory,
      tables: report.restoredTables,
      restoreSeconds: report.restoreSeconds,
    }),
  );
} catch (error) {
  console.error(`[recovery] Stopped during ${phase}; provider details and credentials withheld.`);
  let diagnostic = String(error.stderr ?? error.message ?? 'Unknown failure');
  for (const name of ['DIRECT_URL', 'DATABASE_URL']) {
    if (process.env[name]) {
      diagnostic = diagnostic.replaceAll(process.env[name], '[database URL]');
      const password = decodeURIComponent(new URL(process.env[name]).password);
      if (password) diagnostic = diagnostic.replaceAll(password, '[redacted]');
    }
  }
  console.error(diagnostic.slice(-1200));
  process.exitCode = 1;
} finally {
  if (containerCreated) {
    try {
      await docker(['rm', '-f', container]);
    } catch {
      console.error('[recovery] Disposable restore container cleanup needs attention.');
      process.exitCode = 1;
    }
  }
  // Exact task-created plaintext paths only; encrypted archive/key are retained.
  for (const name of ['snapshot.dump', 'recovered.dump'])
    await rm(join(directory, name), { force: true });
  await db.$disconnect();
}
