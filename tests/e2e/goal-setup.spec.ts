import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { CohortStatus, PrismaClient, RoleName } from '@prisma/client';
import { hash } from 'bcryptjs';

// This fixture belongs only in the disposable local/CI database. Never create
// test participants against a deployed portal's database.
const databaseHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : '';
test.skip(
  !['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseHost),
  'Requires local test database',
);

const prisma = new PrismaClient();
const email = `goal-setup-${randomUUID()}@example.com`;
const password = 'GoalSetup!2026';
let userId = '';
let cohortId = '';
let programmeId = '';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test.beforeAll(async () => {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.MENTEE } });
  const cohort = await prisma.cohort.create({
    data: {
      name: `Goal setup ${randomUUID()}`,
      status: CohortStatus.ACTIVE,
      programme: { create: { name: 'Goal setup browser test' } },
    },
  });
  cohortId = cohort.id;
  programmeId = cohort.programmeId;
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Goal setup participant',
      passwordHash: await hash(password, 12),
      userRoles: { create: { roleId: role.id, cohortId } },
      menteeProfile: { create: { cohortId, fullName: 'Goal setup participant', email } },
    },
  });
  userId = user.id;
});

test.afterAll(async () => {
  const deletedAt = new Date();
  if (userId) {
    await prisma.goal.updateMany({ where: { menteeId: userId }, data: { deletedAt } });
    await prisma.menteeProfile.updateMany({ where: { userId }, data: { deletedAt } });
    await prisma.userRole.updateMany({ where: { userId }, data: { deletedAt } });
    await prisma.user.update({ where: { id: userId }, data: { deletedAt, isActive: false } });
  }
  if (cohortId) await prisma.cohort.update({ where: { id: cohortId }, data: { deletedAt } });
  if (programmeId)
    await prisma.programme.update({ where: { id: programmeId }, data: { deletedAt } });
  await prisma.$disconnect();
});

test('a new mentee must save a goal before accessing the portal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await signIn(page);
  await page.waitForURL('**/goals');
  await expect(page.getByText(/Set your first development goal to continue/)).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);

  for (const route of ['/dashboard', '/profile', '/messages']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/goals$/);
  }

  // Autosaving working text must not satisfy the mandatory goal requirement.
  await page.getByLabel('Goal title').fill('Develop leadership skills');
  await expect
    .poll(() => prisma.formDraft.count({ where: { userId, formKey: 'goal:new' } }))
    .toBe(1);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByLabel('Goal title')).toHaveValue('Develop leadership skills');

  for (let step = 0; step < 4; step++) {
    await page.getByRole('button', { name: 'Next step' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  await page.getByRole('button', { name: 'Save goal and continue' }).click();
  await page.waitForURL('**/dashboard/mentee');
  expect(await prisma.goal.count({ where: { menteeId: userId, cohortId, deletedAt: null } })).toBe(
    1,
  );
  await page.goto('/messages');
  await expect(page).toHaveURL(/\/messages$/);

  await page.context().clearCookies();
  await signIn(page);
  await page.waitForURL('**/dashboard/mentee');
});
