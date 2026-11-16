import 'server-only';
import type { ActionItem, SessionLog } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getMenteePairing, getMentorPairings, type MentorPairing } from '@/lib/pairings';

export { getMenteePairing, getMentorPairings };

export type SessionLogWithDetail = SessionLog & {
  mentor: { name: string | null };
  mentee: { name: string | null };
  actionItems: (ActionItem & { assignee: { name: string | null } | null })[];
};

const logInclude = {
  mentor: { select: { name: true } },
  mentee: { select: { name: true } },
  actionItems: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { assignee: { select: { name: true } } },
  },
} as const;

/** Session logs for a single accepted pair, newest first. */
export async function getPairSessionLogs(
  mentorId: string,
  menteeId: string,
): Promise<SessionLogWithDetail[]> {
  return prisma.sessionLog.findMany({
    where: { mentorId, menteeId, deletedAt: null },
    orderBy: { date: 'desc' },
    include: logInclude,
  });
}

export type MentorSessionGroup = { mentee: MentorPairing; logs: SessionLogWithDetail[] };

/** Current accepted pairs' shared records, grouped for mentor reflection. */
export async function getMentorSessionGroups(userId: string): Promise<MentorSessionGroup[]> {
  const pairings = await getMentorPairings(userId);
  if (pairings.length === 0) return [];

  const logs = await prisma.sessionLog.findMany({
    where: { mentorId: userId, deletedAt: null },
    orderBy: { date: 'desc' },
    include: logInclude,
  });

  return pairings.map((mentee) => ({
    mentee,
    logs: logs.filter((l) => l.menteeId === mentee.menteeId && l.cohortId === mentee.cohortId),
  }));
}

/** Session logs visible to a mentee (their own pair's), newest first. */
export async function getMenteeSessionLogs(userId: string): Promise<SessionLogWithDetail[]> {
  const logs = await prisma.sessionLog.findMany({
    where: { menteeId: userId, deletedAt: null },
    orderBy: { date: 'desc' },
    include: logInclude,
  });
  // Old private mentor scratchpads must not enter the mentee's view model.
  return logs.map((log) => ({ ...log, mentorNotes: null }));
}

/** Approved/active goal titles for a pair — context for the Session Assistant. */
export async function getPairGoalTitles(menteeId: string, cohortId: string): Promise<string[]> {
  const goals = await prisma.goal.findMany({
    where: { menteeId, cohortId, deletedAt: null },
    select: { title: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return goals.map((g) => g.title);
}
