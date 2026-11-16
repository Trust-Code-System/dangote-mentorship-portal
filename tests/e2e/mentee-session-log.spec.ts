import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { signInForAudit } from './helpers/session';

test('mentee records the session and the paired mentor adds the shared reflection', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  test.skip(!process.env.CI, 'Session workflow fixtures run only in disposable CI Postgres.');
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('Requires isolated CI Postgres.');
  const db = new PrismaClient();
  const menteeContext = await browser.newContext({ baseURL: 'http://localhost:3001' });
  const mentorContext = await browser.newContext({ baseURL: 'http://localhost:3001' });
  try {
    const seed = await db.user.findUniqueOrThrow({
      where: { email: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com' },
      select: { passwordHash: true },
    });
    const programme = await db.programme.create({
      data: { name: 'CI session roles', status: 'DRAFT' },
    });
    const cohort = await db.cohort.create({
      data: {
        programmeId: programme.id,
        name: 'CI mentee session logging',
        status: 'DRAFT',
        languages: ['EN'],
      },
    });
    const people = [];
    for (const roleName of ['MENTEE', 'MENTOR'] as const) {
      const email = `session-${roleName.toLowerCase()}-${cohort.id}@example.test`;
      const user = await db.user.create({
        data: {
          name: `CI ${roleName}`,
          email,
          passwordHash: seed.passwordHash,
          isActive: true,
          notificationPreference: { create: { emailEnabled: false, digestEnabled: false } },
        },
      });
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
      await db.userRole.create({ data: { userId: user.id, roleId: role.id, cohortId: cohort.id } });
      people.push(user);
    }
    const [mentee, mentor] = people;
    if (!mentee || !mentor) throw new Error('Fixture missing');
    await db.match.create({
      data: {
        cohortId: cohort.id,
        mentorId: mentor.id,
        menteeId: mentee.id,
        score: 100,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
    const legacy = await db.sessionLog.create({
      data: {
        cohortId: cohort.id,
        mentorId: mentor.id,
        menteeId: mentee.id,
        discussionSummary: 'Historical mentor record',
        mentorNotes: 'Private historical scratchpad',
        menteeReflection: 'Historical mentee reflection',
      },
    });
    const participant = await menteeContext.newPage();
    const reviewer = await mentorContext.newPage();
    const password = process.env.SEED_DEFAULT_PASSWORD!;
    await signInForAudit(participant, mentee.email, password);
    await participant.goto('/sessions');
    await expect(
      participant.getByRole('button', { name: 'Save session log', exact: true }),
    ).toBeVisible();
    await expect(participant.getByLabel('Mentor', { exact: true })).toHaveValue('CI MENTOR');
    await expect(
      participant.getByText('Private historical scratchpad', { exact: true }),
    ).toHaveCount(0);
    await expect(
      participant.getByText('Historical mentee reflection', { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByRole('textbox', { name: 'Mentor reflection', exact: true }),
    ).toHaveCount(0);
    await participant.getByText('Additional session details', { exact: true }).click();
    await participant
      .getByLabel('Discussion summary', { exact: true })
      .fill('Mentee-authored shared session record');
    await participant.getByRole('button', { name: 'Save session log', exact: true }).click();
    // The textarea already contains this text; wait for persistence rather than
    // mistaking the unsaved input for a rendered session card.
    await expect
      .poll(() =>
        db.sessionLog.count({
          where: {
            cohortId: cohort.id,
            discussionSummary: 'Mentee-authored shared session record',
          },
        }),
      )
      .toBe(1);
    const saved = await db.sessionLog.findFirstOrThrow({
      where: { cohortId: cohort.id, discussionSummary: 'Mentee-authored shared session record' },
    });
    expect(saved.recordedById).toBe(mentee.id);
    expect(saved.mentorId).toBe(mentor.id);
    expect(saved.mentorNotes).toBeNull();
    expect(
      await db.notification.count({
        where: { userId: mentor.id, type: 'session_recorded', cohortId: cohort.id },
      }),
    ).toBe(1);
    expect(
      await db.notification.count({
        where: { userId: mentee.id, type: 'session_recorded', cohortId: cohort.id },
      }),
    ).toBe(0);
    await signInForAudit(reviewer, mentor.email, password);
    await reviewer.goto('/sessions');
    await expect(
      reviewer.getByRole('button', { name: 'Save session log', exact: true }),
    ).toHaveCount(0);
    const card = reviewer.locator(`[data-session-log-id="${saved.id}"]`);
    await card
      .getByLabel('Mentor reflection', { exact: true })
      .fill('Mentor reflection on the recorded session');
    await card.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await db.sessionLog.findUniqueOrThrow({ where: { id: saved.id } })).mentorReflection,
      )
      .toBe('Mentor reflection on the recorded session');
    await participant.reload();
    await expect(
      participant.getByText('Mentor reflection on the recorded session', { exact: true }),
    ).toBeVisible();
    await expect(
      participant.getByRole('textbox', { name: 'Mentor reflection', exact: true }),
    ).toHaveCount(0);
    const original = await db.sessionLog.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(original.menteeReflection).toBe('Historical mentee reflection');
    expect(original.mentorNotes).toBe('Private historical scratchpad');
    expect(original.recordedById).toBeNull();
  } finally {
    await menteeContext.close();
    await mentorContext.close();
    await db.$disconnect();
  }
});
