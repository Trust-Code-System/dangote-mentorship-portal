import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { generateInviteToken } from '@/lib/auth/invite';

test('a new participant can accept an invitation and commit its audit record', async ({ page }) => {
  test.skip(!process.env.CI, 'Uses disposable CI Postgres only.');
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('Isolated CI database required.');
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUniqueOrThrow({
      where: { email: process.env.SEED_SUPER_ADMIN_EMAIL! },
    });
    const programme = await db.programme.create({
      data: { name: 'Invitation verification', status: 'DRAFT' },
    });
    const cohort = await db.cohort.create({
      data: { programmeId: programme.id, name: 'Invitation stream', status: 'DRAFT' },
    });
    const { token, tokenHash } = generateInviteToken();
    const email = `invitation-${cohort.id}@example.test`;
    const invite = await db.invite.create({
      data: {
        email,
        tokenHash,
        cohortId: cohort.id,
        roleName: 'MENTEE',
        invitedById: admin.id,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    await page.goto(`/invite/${token}`);
    await page.getByLabel('Full name', { exact: true }).fill('Invitation Test Participant');
    await page.getByLabel('Password', { exact: true }).fill('Isolated-CI-account-2026!');
    await page.getByLabel('Confirm password', { exact: true }).fill('Isolated-CI-account-2026!');
    await page.getByRole('button', { name: 'Activate account', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/mentee/, { timeout: 30_000 });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.isActive).toBe(true);
    expect((await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).status).toBe(
      'ACCEPTED',
    );
    expect(
      await db.auditLog.count({
        where: { actorId: user.id, entityId: invite.id, action: 'invite.accepted' },
      }),
    ).toBe(1);
    expect(
      await db.userRole.count({
        where: { userId: user.id, cohortId: cohort.id, deletedAt: null, role: { name: 'MENTEE' } },
      }),
    ).toBe(1);
  } finally {
    await db.$disconnect();
  }
});
