import { PrismaClient } from '@prisma/client';

// Explicitly requested demo enrolment move. No credentials, prior goals,
// reviews, sessions, meetings, certificate permissions or emails are changed.
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const targetId = 'cmwixp7uh0002fi8g8u0june4';
const previousId = 'cmwc5tmsp0001fizgb8qiwl3i';
const emails = ['blakmoh06@gmail.com', 'oluwadepo.paul@gmail.com'];

async function main() {
  const [actor, cohort, users, roles] = await Promise.all([
    db.user.findFirst({
      where: {
        email: 'admin@dangote.com',
        isActive: true,
        deletedAt: null,
        userRoles: { some: { cohortId: null, deletedAt: null, role: { name: 'SUPER_ADMIN' } } },
      },
      select: { id: true },
    }),
    db.cohort.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, status: true, programme: { select: { name: true } } },
    }),
    db.user.findMany({
      where: { email: { in: emails }, isActive: true, deletedAt: null },
      select: {
        id: true,
        email: true,
        mentorProfile: { select: { cohortId: true } },
        menteeProfile: { select: { cohortId: true } },
      },
    }),
    db.role.findMany({
      where: { name: { in: ['MENTOR', 'MENTEE'] } },
      select: { id: true, name: true },
    }),
  ]);
  const mentor = users.find((u) => u.email === emails[0]);
  const mentee = users.find((u) => u.email === emails[1]);
  if (
    !actor ||
    cohort?.status !== 'ACTIVE' ||
    cohort.programme.name !== 'Dangote Mentorship 2026/2027' ||
    !mentor?.mentorProfile ||
    !mentee?.menteeProfile ||
    roles.length !== 2
  )
    throw new Error(
      'Expected operator, active target stream and both existing demo profiles are required.',
    );
  if (
    ![previousId, targetId].includes(mentor.mentorProfile.cohortId) ||
    ![previousId, targetId].includes(mentee.menteeProfile.cohortId)
  )
    throw new Error('A profile has moved to an unexpected stream; refusing to overwrite it.');
  const pairings = await db.match.findMany({
    where: {
      deletedAt: null,
      status: 'ACCEPTED',
      OR: [{ mentorId: mentor.id }, { menteeId: mentee.id }],
    },
    select: { id: true, cohortId: true, mentorId: true, menteeId: true, score: true },
  });
  if (
    pairings.some(
      (p) =>
        p.mentorId !== mentor.id ||
        p.menteeId !== mentee.id ||
        ![previousId, targetId].includes(p.cohortId),
    )
  )
    throw new Error('Unexpected active pairing; no changes were made.');
  const existing = await db.match.findUnique({
    where: {
      cohortId_mentorId_menteeId: { cohortId: targetId, mentorId: mentor.id, menteeId: mentee.id },
    },
  });
  if (
    existing &&
    (existing.deletedAt || !['ACCEPTED', 'ADMIN_APPROVED', 'SUGGESTED'].includes(existing.status))
  )
    throw new Error('An existing target pairing requires review before activation.');
  const plan = {
    apply,
    targetStream: cohort.name,
    accounts: users.map((u) => ({
      email: u.email,
      mentorProfile: u.mentorProfile,
      menteeProfile: u.menteeProfile,
    })),
    previousAcceptedPairings: pairings,
    targetPairing: existing?.id ?? null,
    preserveHistoricalRecords: true,
    sendEmails: false,
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;
  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261116, 2028)`;
      // Exact old-or-target preconditions also protect against a concurrent operator move.
      const a = await tx.mentorProfile.updateMany({
        where: { userId: mentor.id, deletedAt: null, cohortId: { in: [previousId, targetId] } },
        data: { cohortId: targetId, matchingStatus: 'MATCHED' },
      });
      const b = await tx.menteeProfile.updateMany({
        where: { userId: mentee.id, deletedAt: null, cohortId: { in: [previousId, targetId] } },
        data: { cohortId: targetId, matchingStatus: 'MATCHED' },
      });
      if (a.count !== 1 || b.count !== 1)
        throw new Error('Profile precondition changed; rolling back.');
      for (const [person, name] of [
        [mentor, 'MENTOR'],
        [mentee, 'MENTEE'],
      ] as const) {
        const role = roles.find((r) => r.name === name)!;
        await tx.userRole.upsert({
          where: {
            userId_roleId_cohortId: { userId: person.id, roleId: role.id, cohortId: targetId },
          },
          create: { userId: person.id, roleId: role.id, cohortId: targetId },
          update: { deletedAt: null },
        });
        await tx.userRole.updateMany({
          where: { userId: person.id, roleId: role.id, cohortId: previousId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }
      const closed = await tx.match.updateMany({
        where: {
          cohortId: previousId,
          mentorId: mentor.id,
          menteeId: mentee.id,
          status: 'ACCEPTED',
          deletedAt: null,
        },
        data: { status: 'OVERRIDDEN' },
      });
      const match = await tx.match.upsert({
        where: {
          cohortId_mentorId_menteeId: {
            cohortId: targetId,
            mentorId: mentor.id,
            menteeId: mentee.id,
          },
        },
        create: {
          cohortId: targetId,
          mentorId: mentor.id,
          menteeId: mentee.id,
          score: pairings[0]?.score ?? 100,
          status: 'ACCEPTED',
          approvedById: actor.id,
          acceptedAt: new Date(),
        },
        update: {
          status: 'ACCEPTED',
          approvedById: actor.id,
          acceptedAt: existing?.acceptedAt ?? new Date(),
        },
        select: { id: true, cohortId: true, status: true, menteeCertificateApprovedAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          cohortId: targetId,
          action: 'demo_pair.stream_moved',
          entityType: 'Match',
          entityId: match.id,
          metadata: {
            previousCohortId: previousId,
            targetCohortId: targetId,
            mentorId: mentor.id,
            menteeId: mentee.id,
            previousProfiles: plan.accounts,
            previousAcceptedPairings: pairings.map((p) => p.id),
            closedPreviousPairings: closed.count,
            source: 'User-requested move for the 2026/2027 demo',
            historicalRecordsPreserved: true,
          },
        },
      });
      return match;
    },
    { timeout: 60000 },
  );
  console.log(JSON.stringify({ moved: true, pairing: result }));
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
