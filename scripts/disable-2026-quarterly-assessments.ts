import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const cohortId = 'cmwixp7uh0002fi8g8u0june4';
const key = 'quarterly_assessments_disabled';
const apply = process.argv.includes('--apply');

async function main() {
  const cohort = await db.cohort.findUniqueOrThrow({
    where: { id: cohortId },
    include: { programme: { select: { name: true } } },
  });
  if (cohort.programme.name !== 'Dangote Mentorship 2026/2027' || cohort.deletedAt)
    throw new Error('Expected 2026/2027 stream not found.');
  const windows = await db.assessmentWindow.count({
    where: { cohortId, formType: 'QUARTERLY', isActive: true, deletedAt: null },
  });
  console.info(
    JSON.stringify({
      mode: apply ? 'apply' : 'plan',
      cohortId,
      activeQuarterlyWindows: windows,
      preservesResponses: true,
      preservesOtherForms: true,
    }),
  );
  if (!apply) return;
  const actor = await db.user.findFirstOrThrow({
    where: {
      email: 'admin@dangote.com',
      isActive: true,
      deletedAt: null,
      userRoles: { some: { cohortId: null, deletedAt: null, role: { name: 'SUPER_ADMIN' } } },
    },
    select: { id: true },
  });
  await db.$transaction(async (tx) => {
    const flag = await tx.featureFlag.upsert({
      where: { key_cohortId: { key, cohortId } },
      create: {
        key,
        cohortId,
        enabled: true,
        description: 'Quarterly assessments removed for the 2026/2027 stream by programme request.',
      },
      update: { enabled: true, deletedAt: null },
    });
    const result = await tx.assessmentWindow.updateMany({
      where: { cohortId, formType: 'QUARTERLY', isActive: true, deletedAt: null },
      data: { isActive: false, gatesAccess: false },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        cohortId,
        action: 'quarterly_assessments.disabled',
        entityType: 'FeatureFlag',
        entityId: flag.id,
        metadata: { deactivatedWindows: result.count, preservedResponses: true },
      },
    });
  });
}

main()
  .catch(() => {
    console.error('Assessment policy update failed. No credentials are logged.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
