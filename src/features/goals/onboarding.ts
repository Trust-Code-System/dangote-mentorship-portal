import 'server-only';
import { cache } from 'react';
import { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getMenteePairing } from '@/lib/pairings';
import type { SessionUser } from '@/lib/auth/rbac';

export interface GoalSetupGate {
  locked: boolean;
  cohortId: string | null;
}

// Resolve on the server; a submitted form cannot choose someone else's cohort.
// Goals can be drafted before matching, then reviewed by the accepted mentor.
export const resolveGoalCohortId = cache(async (userId: string): Promise<string | null> => {
  const pairing = await getMenteePairing(userId);
  if (pairing) return pairing.cohortId;
  const grant = await prisma.userRole.findFirst({
    where: {
      userId,
      deletedAt: null,
      cohortId: { not: null },
      role: { name: RoleName.MENTEE },
      cohort: { deletedAt: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { cohortId: true },
  });
  if (grant?.cohortId) return grant.cohortId;
  const profile = await prisma.menteeProfile.findFirst({
    where: { userId, deletedAt: null, cohort: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    select: { cohortId: true },
  });
  return profile?.cohortId ?? null;
});

export const getGoalSetupGate = cache(async (user: SessionUser): Promise<GoalSetupGate> => {
  // Administrators need to manage onboarding. Mentors review, rather than create, goals.
  if (!user.roles.includes(RoleName.MENTEE) || user.roles.includes(RoleName.SUPER_ADMIN)) {
    return { locked: false, cohortId: null };
  }
  const cohortId = await resolveGoalCohortId(user.id);
  if (!cohortId) return { locked: true, cohortId: null };
  const goal = await prisma.goal.findFirst({
    where: { menteeId: user.id, cohortId, deletedAt: null },
    select: { id: true },
  });
  // An actual saved Goal unlocks access. Form autosaves and goals in old cohorts do not.
  return { locked: goal === null, cohortId };
});
