import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PHASE2_FORMS } from '../../src/features/forms/phase2-catalogue';
import { signInForAudit } from './helpers/session';

// Only the disposable CI Postgres may receive these source-form fixtures.
test.describe('2026/2027 source forms', () => {
  test.skip(
    !process.env.CI,
    'Uses the disposable CI database, never local production credentials.',
  );
  let db: PrismaClient;
  let cohortId: string;
  const ids = new Map<string, string>();
  test.beforeAll(async () => {
    if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''))
      throw new Error('Phase 2 fixtures require isolated local CI Postgres.');
    db = new PrismaClient();
    const programme = await db.programme.findFirstOrThrow({ where: { deletedAt: null } });
    const cohort = await db.cohort.create({
      data: {
        programmeId: programme.id,
        name: 'CI Phase 2 source forms',
        languages: ['EN'],
        status: 'DRAFT',
        startDate: new Date('2026-11-16T00:00:00Z'),
      },
    });
    cohortId = cohort.id;
    for (const f of PHASE2_FORMS) {
      const form = await db.formDefinition.create({
        data: {
          cohortId,
          type: f.type,
          roleName: f.roleName,
          title: f.title,
          schema: f.schema,
          isActive: true,
        },
      });
      ids.set(f.code, form.id);
    }
    await db.featureFlag.create({ data: { cohortId, key: 'phase2_goal_setting', enabled: true } });
  });
  test.afterAll(async () => db?.$disconnect());
  for (const source of PHASE2_FORMS) {
    test(`${source.code} shows source sections, dates and declaration without saving`, async ({
      page,
    }) => {
      await signInForAudit(page, 'admin@dangote.com', 'ChangeMe!2026');
      const before = await db.formResponse.count({ where: { formId: ids.get(source.code)! } });
      await page.goto(`/admin/forms/${ids.get(source.code)}/preview`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(source.title);
      await expect(page.getByText('Section 1: About you', { exact: true })).toBeVisible();
      await expect(
        page.getByLabel('Date mentorship officially started', { exact: true }),
      ).toHaveAttribute('type', 'date');
      await expect(page.getByRole('button', { name: /submit/i })).toBeDisabled();
      await expect(page.getByText(/Note for reviewers|Next steps once approved/)).toHaveCount(0);
      expect(await db.formResponse.count({ where: { formId: ids.get(source.code)! } })).toBe(
        before,
      );
    });
  }
  test('cohort catalogue and goal preview preserve data and ordinary admins cannot open confidential follow-up', async ({
    page,
  }) => {
    await signInForAudit(page, 'admin@dangote.com', 'ChangeMe!2026');
    await page.goto(`/admin/forms?cohort=${cohortId}`);
    for (const f of PHASE2_FORMS)
      await expect(page.getByRole('heading', { name: f.title, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Preview updated goal-setting form' }).click();
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next step' }).click();
    await expect(page.getByLabel('Mentee name', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Next review date', { exact: true })).toHaveAttribute(
      'type',
      'date',
    );
    await expect(page.getByRole('button', { name: /save goal/i })).toBeDisabled();
    await page.goto('/programme-concerns');
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Confidential review follow-up', exact: true })).toHaveCount(0);
  });
});
