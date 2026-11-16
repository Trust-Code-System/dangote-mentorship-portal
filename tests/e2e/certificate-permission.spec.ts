import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { signInForAudit } from './helpers/session';

test.describe('explicit admin certificate release', () => {
  test.setTimeout(120_000);
  test.skip(!process.env.CI, 'Fixtures run only in disposable CI Postgres.');
  test('fully completed mentee stays locked, admin permits download, then revocation locks it again', async ({
    browser,
  }) => {
    if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''))
      throw new Error('Requires isolated CI Postgres.');
    const db = new PrismaClient();
    const password = process.env.SEED_DEFAULT_PASSWORD!;
    const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com';
    const adminContext = await browser.newContext({ baseURL: 'http://localhost:3001' });
    const menteeContext = await browser.newContext({ baseURL: 'http://localhost:3001' });
    try {
      const seed = await db.user.findUniqueOrThrow({
        where: { email: adminEmail },
        select: { passwordHash: true },
      });
      const programme = await db.programme.create({
        data: { name: 'CI certificate release', status: 'DRAFT' },
      });
      const cohort = await db.cohort.create({
        data: {
          programmeId: programme.id,
          name: 'CI certificate permission',
          status: 'DRAFT',
          languages: ['EN'],
        },
      });
      const mentor = await db.user.create({
        data: {
          name: 'CI certificate mentor',
          email: `certificate-mentor-${cohort.id}@example.test`,
        },
      });
      const email = `certificate-mentee-${cohort.id}@example.test`;
      const mentee = await db.user.create({
        data: {
          name: 'CI certificate mentee',
          email,
          passwordHash: seed.passwordHash,
          isActive: true,
        },
      });
      const role = await db.role.findUniqueOrThrow({ where: { name: 'MENTEE' } });
      await db.userRole.create({
        data: { userId: mentee.id, roleId: role.id, cohortId: cohort.id },
      });
      await db.menteeProfile.create({
        data: {
          userId: mentee.id,
          cohortId: cohort.id,
          fullName: 'CI certificate mentee',
          email,
          trainingStatus: 'COMPLETED',
        },
      });
      const match = await db.match.create({
        data: {
          cohortId: cohort.id,
          mentorId: mentor.id,
          menteeId: mentee.id,
          score: 100,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      await db.goal.create({
        data: {
          cohortId: cohort.id,
          menteeId: mentee.id,
          title: 'CI completed goal',
          status: 'APPROVED',
        },
      });
      for (const type of ['MIDTERM', 'FINAL'] as const) {
        const form = await db.formDefinition.create({
          data: {
            cohortId: cohort.id,
            type,
            roleName: 'MENTEE',
            title: `CI ${type}`,
            schema: { fields: [] },
            isActive: true,
          },
        });
        await db.formResponse.create({
          data: {
            formId: form.id,
            respondentId: mentee.id,
            answers: {},
            status: 'SUBMITTED',
            submittedAt: new Date(),
          },
        });
      }
      const admin = await adminContext.newPage();
      const participant = await menteeContext.newPage();
      await signInForAudit(participant, email, password);
      await participant.goto('/certificate');
      await expect(participant.getByTestId('certificate-locked')).toBeVisible();
      await expect(participant.locator('#certificate')).toHaveCount(0);
      for (const flags of ['', '&preview=1', '&preview=1&download=1&lang=FR']) {
        expect(
          (
            await participant.request.get(`/api/certificates/${match.id}/pdf?role=mentee${flags}`)
          ).status(),
        ).toBe(403);
      }
      expect(
        (await participant.request.get(`/api/certificates/${match.id}/pdf?role=mentor`)).status(),
      ).toBe(404);
      await signInForAudit(admin, adminEmail, password);
      await admin.goto(`/admin/certificates?participant=${match.id}:mentee`);
      await admin
        .getByRole('button', { name: 'Mark passed and permit certificate', exact: true })
        .click();
      await expect(
        admin.getByRole('button', { name: 'Revoke certificate permission', exact: true }),
      ).toBeVisible();
      await participant.reload();
      await expect(participant.locator('#certificate')).toBeVisible();
      const pdf = await participant.request.get(
        `/api/certificates/${match.id}/pdf?role=mentee&download=1`,
      );
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()['cache-control']).toContain('no-store');
      expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
      await admin
        .getByRole('button', { name: 'Revoke certificate permission', exact: true })
        .click();
      await expect(
        admin.getByRole('button', { name: 'Mark passed and permit certificate', exact: true }),
      ).toBeVisible();
      await participant.reload();
      await expect(participant.getByTestId('certificate-locked')).toBeVisible();
      await expect(participant.locator('#certificate')).toHaveCount(0);
      expect(
        (
          await participant.request.get(`/api/certificates/${match.id}/pdf?role=mentee&preview=1`)
        ).status(),
      ).toBe(403);
      const record = await db.match.findUniqueOrThrow({ where: { id: match.id } });
      expect(record.menteeCertificateApprovedAt).toBeNull();
      expect(record.menteeCertificateApprovedById).toBeNull();
      expect(
        await db.auditLog.count({
          where: {
            entityId: match.id,
            action: {
              in: ['certificate.mentee_release_approved', 'certificate.mentee_release_revoked'],
            },
          },
        }),
      ).toBe(2);
    } finally {
      await adminContext.close();
      await menteeContext.close();
      await db.$disconnect();
    }
  });
});
