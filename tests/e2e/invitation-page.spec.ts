import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';

test('invitation pages handle pending, expired, used and invalid links without crashing', async ({
  page,
}) => {
  test.skip(!process.env.CI, 'Invitation fixtures use disposable CI Postgres only.');
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('Requires isolated CI Postgres.');
  const db = new PrismaClient();
  try {
    const actor = await db.user.findUniqueOrThrow({
      where: { email: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com' },
      select: { id: true },
    });
    const cohort = await db.cohort.findFirstOrThrow({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const state of ['pending', 'expired', 'used'] as const) {
      const token = randomBytes(32).toString('base64url');
      const email = `invite-${randomBytes(8).toString('hex')}@example.test`;
      await db.invite.create({
        data: {
          email,
          roleName: 'MENTEE',
          cohortId: cohort.id,
          invitedById: actor.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          status: state === 'used' ? 'ACCEPTED' : 'PENDING',
          expiresAt: new Date(Date.now() + (state === 'expired' ? -1 : 1) * 86400000),
        },
      });
      await page.goto(`/invite/${token}`);
      await expect(
        page.getByRole('heading', { name: 'Activate your account', exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
      if (state === 'pending') {
        await expect(page.getByLabel('Corporate email', { exact: true })).toHaveValue(email);
        await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
        await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Activate account', exact: true }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByText(
            state === 'used'
              ? 'This invitation has already been used'
              : 'This invitation has expired',
            { exact: true },
          ),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Activate account', exact: true }),
        ).toHaveCount(0);
      }
    }
    await page.goto('/invite/ci-invalid-invitation');
    await expect(page.getByText('This invitation is not valid', { exact: true })).toBeVisible();
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  } finally {
    await db.$disconnect();
  }
});
