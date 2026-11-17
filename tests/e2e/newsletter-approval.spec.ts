import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { signInForAudit } from './helpers/session';
import { emptyNewsletterBody } from '@/features/newsletters/schema';

test('newsletter edits withdraw approval and require a fresh human sign-off', async ({ page }) => {
  test.skip(!process.env.CI, 'Uses disposable CI Postgres only.');
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('Isolated CI database required.');
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUniqueOrThrow({
      where: { email: process.env.SEED_SUPER_ADMIN_EMAIL! },
    });
    const programme = await db.programme.create({
      data: { name: 'Newsletter verification', status: 'DRAFT' },
    });
    const cohort = await db.cohort.create({
      data: {
        programmeId: programme.id,
        name: 'Newsletter stream',
        status: 'DRAFT',
        languages: ['EN'],
      },
    });
    const body = emptyNewsletterBody();
    body.sections[0]!.bodyEn = 'Prepare for your next mentoring session.';
    const issue = await db.newsletter.create({
      data: {
        cohortId: cohort.id,
        createdById: admin.id,
        title: 'Review verification',
        subjectEn: 'Programme update',
        bodyJson: body,
      },
    });
    await signInForAudit(page, admin.email, process.env.SEED_DEFAULT_PASSWORD!);
    await page.goto(`/admin/newsletters/${issue.id}`);
    await expect(page.getByRole('button', { name: /Send to .* people now/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Approve this issue', exact: true }).click();
    await expect
      .poll(
        async () => (await db.newsletter.findUniqueOrThrow({ where: { id: issue.id } })).approvedAt,
      )
      .not.toBeNull();
    await expect(
      page.getByRole('button', { name: 'Send to 0 people now', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Subject (English)', { exact: true }).fill('Updated programme reminder');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect
      .poll(
        async () => (await db.newsletter.findUniqueOrThrow({ where: { id: issue.id } })).approvedAt,
      )
      .toBeNull();
    await expect(
      page.getByRole('button', { name: 'Approve this issue', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Send to .* people now/ })).toHaveCount(0);
    const saved = await db.newsletter.findUniqueOrThrow({ where: { id: issue.id } });
    expect(saved.subjectEn).toBe('Updated programme reminder');
    expect(saved.status).toBe('DRAFT');
    expect(saved.sentAt).toBeNull();
    expect(await db.newsletterRecipient.count({ where: { newsletterId: issue.id } })).toBe(0);
  } finally {
    await db.$disconnect();
  }
});
