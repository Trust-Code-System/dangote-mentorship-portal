import 'server-only';
import { GoalStatus, MatchStatus, TrainingStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// Completion Certificate (stakeholder request 2026-07: "give them certificates …
// design a sample and put it in the portal"). Derives certificate details from
// real records for the viewer's accepted pairing. `earned` mirrors the journey
// `completion` step (training done + an approved goal today; reviews join in M3);
// when not yet earned the page renders a clearly-marked PREVIEW so admins and
// stakeholders can see the design before anyone graduates.

export type CertificateRole = 'mentee' | 'mentor';

export interface CertificateData {
  recipientName: string;
  role: CertificateRole;
  programmeName: string;
  cohortName: string;
  counterpartName: string | null;
  earned: boolean;
  /** ISO yyyy-mm-dd — the earned date when available, else today (preview). */
  issuedDate: string;
  /** Short human-readable verification id derived from the pairing. */
  certificateId: string;
}

export async function getCertificateData(userId: string): Promise<CertificateData | null> {
  const match = await prisma.match.findFirst({
    where: {
      status: MatchStatus.ACCEPTED,
      deletedAt: null,
      OR: [{ menteeId: userId }, { mentorId: userId }],
    },
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true } },
      cohort: { select: { id: true, name: true, programme: { select: { name: true } } } },
    },
  });
  if (!match) return null;

  const role: CertificateRole = match.menteeId === userId ? 'mentee' : 'mentor';
  const recipientName = (role === 'mentee' ? match.mentee.name : match.mentor.name) ?? 'Participant';
  const counterpartName = role === 'mentee' ? match.mentor.name : match.mentee.name;

  // Earned check. Mentee: their own training complete + at least one approved goal.
  // Mentor: their paired mentee reached an approved goal (they mentored to completion).
  const [profileTrained, approvedGoal] = await Promise.all([
    role === 'mentee'
      ? prisma.menteeProfile.findFirst({
          where: { userId, cohortId: match.cohortId, deletedAt: null },
          select: { trainingStatus: true },
        })
      : prisma.mentorProfile.findFirst({
          where: { userId, cohortId: match.cohortId, deletedAt: null },
          select: { trainingStatus: true },
        }),
    prisma.goal.findFirst({
      where: {
        cohortId: match.cohortId,
        menteeId: match.menteeId,
        status: GoalStatus.APPROVED,
        deletedAt: null,
      },
      select: { updatedAt: true },
    }),
  ]);

  const trained = profileTrained?.trainingStatus === TrainingStatus.COMPLETED;
  const earned = Boolean(trained && approvedGoal);
  const issuedDate = (approvedGoal?.updatedAt ?? new Date()).toISOString().slice(0, 10);
  const certificateId = `BM-${match.cohort.id.slice(-4)}-${match.id.slice(-6)}`.toUpperCase();

  return {
    recipientName,
    role,
    programmeName: match.cohort.programme?.name ?? 'BLAK MOH Mentorship Programme',
    cohortName: match.cohort.name,
    counterpartName,
    earned,
    issuedDate,
    certificateId,
  };
}
