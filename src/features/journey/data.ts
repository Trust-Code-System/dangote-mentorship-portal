import 'server-only';
import { AgreementType, GoalStatus, MatchStatus, ReviewType, TrainingStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { hasSubmittedReview } from '@/features/reviews/data';
import { computeJourney, type JourneyFacts, type JourneyResult, type JourneyRole } from './journey';

// Gathers the real records that feed the Journey Tracker (experience-layer.md
// §1.2) and hands them to the pure engine. One query batch per dashboard load.

const SUBMITTED_OR_BEYOND: GoalStatus[] = [
  GoalStatus.SUBMITTED,
  GoalStatus.APPROVED,
  GoalStatus.COMPLETED,
];
const APPROVED_OR_BEYOND: GoalStatus[] = [GoalStatus.APPROVED, GoalStatus.COMPLETED];

function menteeProfileComplete(
  p: {
    fullName: string;
    department: string | null;
    jobTitle: string | null;
    careerGoals: string | null;
  } | null,
): boolean {
  return Boolean(p && p.fullName && p.department && p.jobTitle && p.careerGoals);
}

function mentorProfileComplete(
  p: {
    fullName: string;
    department: string | null;
    jobTitle: string | null;
    whyMentor: string | null;
  } | null,
): boolean {
  return Boolean(p && p.fullName && p.department && p.jobTitle && p.whyMentor);
}

async function confidentialitySigned(userId: string, cohortId: string | null): Promise<boolean> {
  if (!cohortId) return false;
  const agreement = await prisma.agreement.findFirst({
    where: {
      signedById: userId,
      cohortId,
      type: AgreementType.CONFIDENTIALITY,
      signedAt: { not: null },
      deletedAt: null,
    },
    select: { id: true },
  });
  return agreement !== null;
}

async function menteeFacts(userId: string, now: Date): Promise<JourneyFacts> {
  const match = await prisma.match.findFirst({
    where: { menteeId: userId, status: MatchStatus.ACCEPTED, deletedAt: null },
    orderBy: { acceptedAt: 'desc' },
    select: {
      acceptedAt: true,
      cohortId: true,
      menteeCertificateApprovedAt: true,
      menteeCertificateApprovedById: true,
    },
  });
  const cohortId = match?.cohortId ?? null;
  const [profile, goals, sessionAgg, signed] = await Promise.all([
    prisma.menteeProfile.findFirst({
      where: { userId, deletedAt: null, ...(cohortId ? { cohortId } : {}) },
      select: {
        fullName: true,
        department: true,
        jobTitle: true,
        careerGoals: true,
        trainingStatus: true,
      },
    }),
    cohortId
      ? prisma.goal.findMany({
          where: { menteeId: userId, cohortId, deletedAt: null },
          select: { status: true },
        })
      : Promise.resolve([]),
    cohortId
      ? prisma.sessionLog.aggregate({
          where: { menteeId: userId, cohortId, deletedAt: null },
          _count: { _all: true },
          _max: { date: true },
        })
      : Promise.resolve({ _count: { _all: 0 }, _max: { date: null } }),
    confidentialitySigned(userId, cohortId),
  ]);

  // Review steps are driven by real submissions once a pairing (and thus a
  // cohort) exists; unmatched users simply haven't reached this step.
  const [midtermDone, finalDone] = match
    ? await Promise.all([
        hasSubmittedReview(userId, match.cohortId, ReviewType.MIDTERM),
        hasSubmittedReview(userId, match.cohortId, ReviewType.FINAL),
      ])
    : [false, false];

  return {
    role: 'mentee',
    certificateApproved: Boolean(
      match?.menteeCertificateApprovedAt && match.menteeCertificateApprovedById,
    ),
    profileComplete: menteeProfileComplete(profile),
    trainingCompleted: profile?.trainingStatus === TrainingStatus.COMPLETED,
    trainingInProgress: profile?.trainingStatus === TrainingStatus.IN_PROGRESS,
    matched: match !== null,
    matchedAt: match?.acceptedAt ?? null,
    confidentialitySigned: signed,
    goalsSubmitted: goals.some((g) => SUBMITTED_OR_BEYOND.includes(g.status)),
    goalsApproved: goals.some((g) => APPROVED_OR_BEYOND.includes(g.status)),
    sessionCount: sessionAgg._count._all,
    lastSessionAt: sessionAgg._max.date ?? null,
    midtermDone,
    finalDone,
    now,
  };
}

async function mentorFacts(userId: string, now: Date): Promise<JourneyFacts> {
  const matches = await prisma.match.findMany({
    where: { mentorId: userId, status: MatchStatus.ACCEPTED, deletedAt: null },
    orderBy: { acceptedAt: 'desc' },
    select: { menteeId: true, acceptedAt: true, cohortId: true },
  });
  const cohortId = matches[0]?.cohortId ?? null;
  const menteeIds = matches
    .filter((match) => match.cohortId === cohortId)
    .map((match) => match.menteeId);

  const [profile, goals, sessionAgg, signed] = await Promise.all([
    prisma.mentorProfile.findFirst({
      where: { userId, deletedAt: null, ...(cohortId ? { cohortId } : {}) },
      select: {
        fullName: true,
        department: true,
        jobTitle: true,
        whyMentor: true,
        trainingStatus: true,
      },
    }),
    menteeIds.length
      ? prisma.goal.findMany({
          where: {
            menteeId: { in: menteeIds },
            cohortId: cohortId!,
            deletedAt: null,
            status: { not: GoalStatus.DRAFT },
          },
          select: { status: true },
        })
      : Promise.resolve([]),
    prisma.sessionLog.aggregate({
      where: {
        mentorId: userId,
        cohortId: cohortId ?? '',
        menteeId: { in: menteeIds },
        deletedAt: null,
      },
      _count: { _all: true },
      _max: { date: true },
    }),
    confidentialitySigned(userId, cohortId),
  ]);

  const [midtermDone, finalDone] = cohortId
    ? await Promise.all([
        hasSubmittedReview(userId, cohortId, ReviewType.MIDTERM),
        hasSubmittedReview(userId, cohortId, ReviewType.FINAL),
      ])
    : [false, false];

  return {
    role: 'mentor',
    profileComplete: mentorProfileComplete(profile),
    trainingCompleted: profile?.trainingStatus === TrainingStatus.COMPLETED,
    trainingInProgress: profile?.trainingStatus === TrainingStatus.IN_PROGRESS,
    matched: matches.length > 0,
    matchedAt: matches[0]?.acceptedAt ?? null,
    confidentialitySigned: signed,
    goalsSubmitted: goals.some((g) => SUBMITTED_OR_BEYOND.includes(g.status)),
    goalsApproved: goals.some((g) => APPROVED_OR_BEYOND.includes(g.status)),
    sessionCount: sessionAgg._count._all,
    lastSessionAt: sessionAgg._max.date ?? null,
    midtermDone,
    finalDone,
    now,
  };
}

/** Compute the journey for a user in a given role. */
export async function getJourney(userId: string, role: JourneyRole): Promise<JourneyResult> {
  const now = new Date();
  const facts = role === 'mentor' ? await mentorFacts(userId, now) : await menteeFacts(userId, now);
  return computeJourney(facts);
}
