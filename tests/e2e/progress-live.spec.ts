import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { signInForAudit } from './helpers/session';

test('saved agreements, goal approvals and action completion update real progress', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  test.skip(!process.env.CI, 'Writes only to disposable CI Postgres.');
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('Isolated CI database required.');
  const db = new PrismaClient();
  const menteeContext = await browser.newContext({ baseURL: 'http://localhost:3001' });
  const mentorContext = await browser.newContext({ baseURL: 'http://localhost:3001' });
  menteeContext.setDefaultTimeout(15_000);
  mentorContext.setDefaultTimeout(15_000);
  try {
    const seed = await db.user.findUniqueOrThrow({
      where: { email: process.env.SEED_SUPER_ADMIN_EMAIL! },
      select: { passwordHash: true },
    });
    const programme = await db.programme.create({
      data: { name: 'CI progress verification', status: 'DRAFT' },
    });
    const current = await db.cohort.create({
      data: {
        programmeId: programme.id,
        name: 'Current progress stream',
        status: 'DRAFT',
        languages: ['EN'],
      },
    });
    const historical = await db.cohort.create({
      data: { programmeId: programme.id, name: 'Historical progress stream', status: 'COMPLETED' },
    });
    const mentee = await db.user.create({
      data: {
        name: 'Progress Mentee',
        email: `progress-mentee-${current.id}@example.test`,
        passwordHash: seed.passwordHash,
        notificationPreference: { create: { emailEnabled: false, digestEnabled: false } },
      },
    });
    const mentor = await db.user.create({
      data: {
        name: 'Progress Mentor',
        email: `progress-mentor-${current.id}@example.test`,
        passwordHash: seed.passwordHash,
        notificationPreference: { create: { emailEnabled: false, digestEnabled: false } },
      },
    });
    for (const [user, roleName] of [
      [mentee, 'MENTEE'],
      [mentor, 'MENTOR'],
    ] as const) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
      await db.userRole.create({
        data: { userId: user.id, roleId: role.id, cohortId: current.id },
      });
    }
    await db.menteeProfile.create({
      data: {
        userId: mentee.id,
        cohortId: current.id,
        fullName: mentee.name!,
        email: mentee.email,
        department: 'Operations',
        jobTitle: 'Engineer',
        careerGoals: 'Lead a team',
        trainingStatus: 'COMPLETED',
      },
    });
    await db.mentorProfile.create({
      data: {
        userId: mentor.id,
        cohortId: current.id,
        fullName: mentor.name!,
        email: mentor.email,
        department: 'Operations',
        jobTitle: 'Manager',
        whyMentor: 'Develop leaders',
        trainingStatus: 'COMPLETED',
      },
    });
    await db.match.create({
      data: {
        mentorId: mentor.id,
        menteeId: mentee.id,
        cohortId: current.id,
        score: 100,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
    const goal = await db.goal.create({
      data: {
        menteeId: mentee.id,
        cohortId: current.id,
        title: 'Live leadership goal',
        status: 'SUBMITTED',
        stage: 'MENTOR_REVIEWED',
      },
    });
    // Historical completion must not inflate this stream's goals or journey.
    await db.goal.create({
      data: {
        menteeId: mentee.id,
        cohortId: historical.id,
        title: 'Old completed goal',
        status: 'COMPLETED',
        stage: 'ACHIEVED',
      },
    });
    await db.agreement.create({
      data: {
        cohortId: historical.id,
        signedById: mentee.id,
        type: 'CONFIDENTIALITY',
        signedAt: new Date(),
      },
    });
    await db.sessionLog.create({
      data: { cohortId: historical.id, mentorId: mentor.id, menteeId: mentee.id, date: new Date() },
    });
    const page = await menteeContext.newPage();
    const reviewer = await mentorContext.newPage();
    await signInForAudit(page, mentee.email, process.env.SEED_DEFAULT_PASSWORD!);
    const metric = page
      .getByRole('link')
      .filter({ has: page.getByText('Goal progress', { exact: true }) });
    await expect(metric).toContainText('20%');
    await expect(
      page.getByRole('link', { name: 'Confidentiality agreement — Your turn', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Monthly sessions — Your turn', exact: true }),
    ).toBeVisible();
    await page.goto(`/pair/${mentee.id}`);
    await expect(
      page.getByRole('link', { name: 'Agreement — current step', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Top goal progress' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );
    await expect(page.getByText('AI suggested', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Edit note', { exact: true })).toHaveCount(0);
    await signInForAudit(reviewer, mentor.email, process.env.SEED_DEFAULT_PASSWORD!);
    for (const [person, name] of [
      [page, mentee.name!],
      [reviewer, mentor.name!],
    ] as const) {
      await person.goto('/agreements');
      for (const type of ['MENTORING', 'CONFIDENTIALITY']) {
        const form = person
          .locator('form')
          .filter({ has: person.locator(`input[name="type"][value="${type}"]`) });
        await form.locator('input[name="typedName"]').fill(name);
        await form.getByRole('checkbox').check();
        await form.getByRole('button', { name: 'Sign agreement', exact: true }).click();
        await expect(form).toHaveCount(0);
      }
    }
    await reviewer.goto('/goals');
    await reviewer.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect
      .poll(async () => (await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).status)
      .toBe('APPROVED');
    await page.goto('/goals');
    await page
      .locator('form')
      .filter({ has: page.locator('input[name="stage"][value="IN_PROGRESS"]') })
      .getByRole('button')
      .click();
    await expect
      .poll(async () => (await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).stage)
      .toBe('IN_PROGRESS');
    await page.goto('/dashboard/mentee');
    await expect(metric).toContainText('60%');
    await page.goto(`/pair/${mentee.id}`);
    await expect(
      page.getByRole('link', { name: 'Agreement — completed', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Top goal progress' })).toHaveAttribute(
      'aria-valuenow',
      '60',
    );
    const log = await db.sessionLog.create({
      data: {
        cohortId: current.id,
        mentorId: mentor.id,
        menteeId: mentee.id,
        recordedById: mentee.id,
        date: new Date(),
        competencyDiscussed: 'Current leadership session',
      },
    });
    const item = await db.actionItem.create({
      data: {
        cohortId: current.id,
        sessionLogId: log.id,
        title: 'Complete the leadership action',
        createdById: mentee.id,
        assigneeId: mentee.id,
      },
    });
    await page.goto('/sessions');
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    await page.getByRole('option', { name: 'Completed', exact: true }).click();
    await expect
      .poll(async () => (await db.actionItem.findUniqueOrThrow({ where: { id: item.id } })).status)
      .toBe('DONE');
    await page.goto(`/pair/${mentee.id}`);
    await expect(
      page.getByRole('link', { name: 'Action plan — completed', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Closure — current step', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Current leadership session', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open journal', exact: false })).toHaveAttribute(
      'href',
      '/journal',
    );
  } finally {
    await Promise.allSettled([menteeContext.close(), mentorContext.close()]);
    await db.$disconnect();
  }
});
