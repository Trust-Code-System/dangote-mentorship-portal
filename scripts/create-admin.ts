/**
 * Bootstrap (or reset) a single Super Admin — the real, production way to get an
 * administrator account, as opposed to `db:seed`, which fabricates a whole demo
 * cohort and must never touch production.
 *
 * It does exactly four things, and nothing else:
 *   1. ensures the SUPER_ADMIN role exists,
 *   2. creates the user (or, if the email already exists, resets its password
 *      and reactivates it),
 *   3. grants a global SUPER_ADMIN role (cohortId = null → adminCohortScope 'ALL'),
 *   4. writes an audit_logs row.
 *
 * Credentials come from the environment, never the command line (argv leaks into
 * shell history and `ps`):
 *
 *   ADMIN_EMAIL="you@company.com" \
 *   ADMIN_PASSWORD="a-real-strong-password" \
 *   ADMIN_NAME="Jane Doe" \
 *     npm run admin:create
 *
 * Because this is the one script meant to write to production, it prints the
 * target database (credentials stripped) and asks for confirmation before any
 * write. Set ADMIN_CONFIRM_TARGET to the printed "host/db" to skip the prompt in
 * a non-interactive context (CI, a one-off deploy step).
 */
import { createInterface } from 'node:readline/promises';
import { PrismaClient, RoleName } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

/** Host/db of the target, credentials stripped, safe to print. */
function describeTarget(url: string | undefined): string {
  if (!url) return '(DATABASE_URL not set)';
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '') || '(default)';
    return `${u.hostname}${u.port ? `:${u.port}` : ''}/${db}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set. See the header of scripts/create-admin.ts.`);
  return value;
}

/** Refuse the weakest and the known-public passwords outright. */
function assertPasswordUsable(password: string): void {
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }
  // The seed's committed default was public while the repo was; never let it
  // become a real admin credential.
  if (/^ChangeMe!20\d\d$/i.test(password)) {
    throw new Error('ADMIN_PASSWORD is the public seed default. Choose a real password.');
  }
}

async function confirmTarget(target: string): Promise<void> {
  const preapproved = process.env.ADMIN_CONFIRM_TARGET?.trim();
  if (preapproved) {
    if (preapproved !== target) {
      throw new Error(
        `ADMIN_CONFIRM_TARGET is "${preapproved}" but DATABASE_URL points at "${target}". ` +
          'Refusing to write to a database you did not confirm.',
      );
    }
    return;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      `Refusing to write to ${target} without confirmation. Re-run with ` +
        `ADMIN_CONFIRM_TARGET="${target}" to proceed non-interactively.`,
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nThis will write a SUPER_ADMIN to:\n  ${target}\nType "yes" to proceed: `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    throw new Error('Aborted.');
  }
}

async function ensureSuperAdminRole(): Promise<string> {
  const existing = await prisma.role.findFirst({ where: { name: RoleName.SUPER_ADMIN } });
  if (existing) return existing.id;
  const created = await prisma.role.create({ data: { name: RoleName.SUPER_ADMIN } });
  return created.id;
}

async function main(): Promise<void> {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  assertPasswordUsable(password);

  const target = describeTarget(process.env.DATABASE_URL);
  await confirmTarget(target);

  const passwordHash = await hashPassword(password);
  const roleId = await ensureSuperAdminRole();

  // Create, or reset+reactivate if the email already exists. This is how you
  // rotate a compromised admin password too: same command, same email.
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: { passwordHash, isActive: true, deletedAt: null, emailVerified: new Date(), name },
      })
    : await prisma.user.create({
        data: { email, name, passwordHash, emailVerified: new Date(), isActive: true },
      });

  // Global grant (cohortId null). Compound unique includes the nullable cohortId,
  // and Postgres treats NULLs as distinct, so look up explicitly then create/restore.
  const grant = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId, cohortId: null },
  });
  if (!grant) {
    await prisma.userRole.create({ data: { userId: user.id, roleId, cohortId: null } });
  } else if (grant.deletedAt) {
    await prisma.userRole.update({ where: { id: grant.id }, data: { deletedAt: null } });
  }

  await prisma.auditLog.create({
    data: {
      actorId: null, // system action; no signed-in actor
      action: existing ? 'admin.reset' : 'admin.bootstrap',
      entityType: 'User',
      entityId: user.id,
      metadata: { email, viaScript: 'scripts/create-admin.ts' },
    },
  });

  console.log(`\n${existing ? 'Reset' : 'Created'} Super Admin: ${email}`);
  console.log(`Target: ${target}`);
  console.log('Password was taken from ADMIN_PASSWORD and is not printed.');
}

main()
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
