import 'server-only';
import { type Goal, type GoalEvidence, type GoalReview } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  getMenteePairing,
  getMentorPairings,
  isAcceptedPair,
  type MentorPairing,
} from '@/lib/pairings';

// All goal I/O lives here; the pure stage/SMART modules never touch the DB.
// A goal belongs to a mentee and is approved by the mentor they are paired with,
// so most access decisions hinge on the accepted Match (CLAUDE.md M2).

export { getMenteePairing, getMentorPairings };

/** True when the mentor is the accepted partner of the goal's mentee in its cohort. */
export async function isMentorOfGoal(mentorId: string, goal: Goal): Promise<boolean> {
  return isAcceptedPair(mentorId, goal.menteeId, goal.cohortId);
}

export type GoalWithDetail = Goal & {
  reviews: (GoalReview & { reviewer: { name: string | null } })[];
  evidenceFiles: GoalEvidence[];
};

export async function getMenteeGoals(userId: string): Promise<GoalWithDetail[]> {
  return prisma.goal.findMany({
    where: { menteeId: userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { name: true } } },
      },
      evidenceFiles: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
    },
  });
}

export type MenteeGoalGroup = { mentee: MentorPairing; goals: GoalWithDetail[] };

/** Goals of every mentee this mentor is paired with, grouped per mentee for review. */
export async function getGoalsForMentor(userId: string): Promise<MenteeGoalGroup[]> {
  const pairings = await getMentorPairings(userId);
  if (pairings.length === 0) return [];

  const goals = await prisma.goal.findMany({
    where: {
      OR: pairings.map((pairing) => ({ menteeId: pairing.menteeId, cohortId: pairing.cohortId })),
      deletedAt: null,
      // Mentors never see a goal still in the mentee's private draft.
      status: { not: 'DRAFT' },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { name: true } } },
      },
      evidenceFiles: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
    },
  });

  return pairings.map((mentee) => ({
    mentee,
    goals: goals.filter((g) => g.menteeId === mentee.menteeId && g.cohortId === mentee.cohortId),
  }));
}
