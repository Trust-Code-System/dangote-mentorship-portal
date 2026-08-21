'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { MatchStatus, MatchingStatus, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { assertCohortAccess, requireRole, requireUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { notify, notifyMany } from '@/lib/notifications/notify';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import {
  scoreMatch,
  type MatchingCriteriaConfig,
  type MatchingHardRules,
  type MatchingWeights,
} from './engine';
import { loadMentorsForMatching, loadMenteesForMatching, COMMITTED_STATUSES } from './data';

const ADMIN: RoleName[] = [RoleName.SUPER_ADMIN];

/** Suggestions kept per mentee on each run. */
const TOP_N = 3;

async function loadCriteria(cohortId: string): Promise<Partial<MatchingCriteriaConfig>> {
  const criteria = await prisma.matchingCriteria.findFirst({
    where: { cohortId, isActive: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!criteria) return {};
  return {
    weights: criteria.weights as unknown as MatchingWeights,
    hardRules: criteria.hardRules as unknown as MatchingHardRules,
  };
}

const runSchema = z.object({ cohortId: z.string().cuid() });

/**
 * Run the matching engine for a cohort (CLAUDE.md §8). Produces SUGGESTED
 * matches only — the AI/engine proposes, the admin approves (§0 rule 5).
 * Mentees that already have a committed match are skipped; previous
 * suggestions are replaced.
 */
export async function runMatching(
  formData: FormData,
): Promise<ActionResult<{ suggested: number; menteesMatched: number }>> {
  try {
    const actor = await requireRole(ADMIN);
    const { cohortId } = runSchema.parse({ cohortId: formData.get('cohortId') });
    assertCohortAccess(actor, cohortId);

    const [criteria, mentors, mentees] = await Promise.all([
      loadCriteria(cohortId),
      loadMentorsForMatching(cohortId),
      loadMenteesForMatching(cohortId),
    ]);

    const committed = await prisma.match.findMany({
      where: { cohortId, status: { in: COMMITTED_STATUSES }, deletedAt: null },
      select: { menteeId: true },
    });
    const alreadyMatched = new Set(committed.map((m) => m.menteeId));

    // Track capacity as we hand out suggestions so one strong mentor doesn't
    // absorb every mentee's slot in a single run.
    const suggestedLoad = new Map<string, number>();

    let suggested = 0;
    let menteesMatched = 0;

    for (const mentee of mentees) {
      if (alreadyMatched.has(mentee.id)) continue;

      const ranked = mentors
        .map((mentor) => {
          const load = suggestedLoad.get(mentor.id) ?? 0;
          const result = scoreMatch(
            { ...mentor, currentMenteeCount: mentor.currentMenteeCount + load },
            mentee,
            criteria,
          );
          return { mentor, result };
        })
        .filter((r) => r.result.eligible)
        .sort((a, b) => b.result.score - a.result.score)
        .slice(0, TOP_N);

      // Replace previous suggestions for this mentee (soft-delete, §3).
      await prisma.match.updateMany({
        where: { cohortId, menteeId: mentee.id, status: MatchStatus.SUGGESTED, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      for (const { mentor, result } of ranked) {
        await prisma.match.upsert({
          where: {
            cohortId_mentorId_menteeId: { cohortId, mentorId: mentor.id, menteeId: mentee.id },
          },
          update: {
            score: result.score,
            status: MatchStatus.SUGGESTED,
            aiRationale: result.rationale,
            flags: result.flags as unknown as Prisma.InputJsonValue,
            deletedAt: null,
          },
          create: {
            cohortId,
            mentorId: mentor.id,
            menteeId: mentee.id,
            score: result.score,
            status: MatchStatus.SUGGESTED,
            aiRationale: result.rationale,
            flags: result.flags as unknown as Prisma.InputJsonValue,
          },
        });
        suggested += 1;
      }

      if (ranked.length > 0) {
        menteesMatched += 1;
        const top = ranked[0];
        if (top) suggestedLoad.set(top.mentor.id, (suggestedLoad.get(top.mentor.id) ?? 0) + 1);
      }
    }

    await writeAuditLog({
      actorId: actor.id,
      cohortId,
      action: 'matching.run',
      entityType: 'Cohort',
      entityId: cohortId,
      metadata: { suggested, menteesMatched, mentees: mentees.length, mentors: mentors.length },
    });

    revalidatePath('/admin/matching');
    return ok({ suggested, menteesMatched });
  } catch (error) {
    return mapActionError(error);
  }
}

const matchIdSchema = z.object({ matchId: z.string().cuid() });

/** Admin approves a suggested match; sibling suggestions for the mentee are retired. */
export async function approveMatch(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(ADMIN);
    const { matchId } = matchIdSchema.parse({ matchId: formData.get('matchId') });

    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    assertCohortAccess(actor, match.cohortId);
    if (match.status !== MatchStatus.SUGGESTED) {
      return fail({ code: 'CONFLICT', message: 'Only suggested matches can be approved.' });
    }

    await prisma.$transaction([
      prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.ADMIN_APPROVED, approvedById: actor.id },
      }),
      // Retire the mentee's other open suggestions.
      prisma.match.updateMany({
        where: {
          cohortId: match.cohortId,
          menteeId: match.menteeId,
          status: MatchStatus.SUGGESTED,
          id: { not: matchId },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      }),
    ]);

    await writeAuditLog({
      actorId: actor.id,
      cohortId: match.cohortId,
      action: 'match.approved',
      entityType: 'Match',
      entityId: matchId,
      metadata: { mentorId: match.mentorId, menteeId: match.menteeId, score: match.score },
    });

    // Tell both participants their match is ready to act on (§1.10 match_ready).
    await notifyMany([match.mentorId, match.menteeId], {
      type: 'match_ready',
      link: '/dashboard',
      cohortId: match.cohortId,
    });

    revalidatePath('/admin/matching');
    return ok({ id: matchId });
  } catch (error) {
    return mapActionError(error);
  }
}

const overrideSchema = z.object({
  cohortId: z.string().cuid(),
  menteeId: z.string().cuid(),
  mentorId: z.string().cuid(),
});

/**
 * Admin manually assigns a mentor outside the suggestions. Every override is
 * audited (§8). The language hard rule still applies — an override can bend
 * soft constraints (capacity, training) but can never cross languages.
 */
export async function overrideMatch(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(ADMIN);
    const { cohortId, menteeId, mentorId } = overrideSchema.parse({
      cohortId: formData.get('cohortId'),
      menteeId: formData.get('menteeId'),
      mentorId: formData.get('mentorId'),
    });
    assertCohortAccess(actor, cohortId);

    const [mentors, mentees, criteria] = await Promise.all([
      loadMentorsForMatching(cohortId),
      loadMenteesForMatching(cohortId),
      loadCriteria(cohortId),
    ]);
    const mentor = mentors.find((m) => m.id === mentorId);
    const mentee = mentees.find((m) => m.id === menteeId);
    if (!mentor || !mentee) {
      return fail({ code: 'NOT_FOUND', message: 'Mentor or mentee not found in this cohort.' });
    }

    const result = scoreMatch(mentor, mentee, criteria);
    if (!result.eligible && result.failedRules.includes('LANGUAGE_MISMATCH')) {
      return fail({
        code: 'CONFLICT',
        message: 'Cross-language pairing is not allowed — this rule cannot be overridden.',
      });
    }

    const match = await prisma.match.upsert({
      where: { cohortId_mentorId_menteeId: { cohortId, mentorId, menteeId } },
      update: {
        status: MatchStatus.OVERRIDDEN,
        approvedById: actor.id,
        score: result.score,
        aiRationale: result.rationale,
        flags: result.flags as unknown as Prisma.InputJsonValue,
        deletedAt: null,
      },
      create: {
        cohortId,
        mentorId,
        menteeId,
        status: MatchStatus.OVERRIDDEN,
        approvedById: actor.id,
        score: result.score,
        aiRationale: result.rationale,
        flags: result.flags as unknown as Prisma.InputJsonValue,
      },
    });

    // Retire open suggestions for the mentee.
    await prisma.match.updateMany({
      where: {
        cohortId,
        menteeId,
        status: MatchStatus.SUGGESTED,
        id: { not: match.id },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      actorId: actor.id,
      cohortId,
      action: 'match.overridden',
      entityType: 'Match',
      entityId: match.id,
      metadata: {
        mentorId,
        menteeId,
        engineEligible: result.eligible,
        failedRules: result.eligible ? [] : result.failedRules,
        score: result.score,
      },
    });

    // Tell both participants their match is ready to act on (§1.10 match_ready).
    await notifyMany([mentorId, menteeId], {
      type: 'match_ready',
      link: '/dashboard',
      cohortId,
    });

    revalidatePath('/admin/matching');
    return ok({ id: match.id });
  } catch (error) {
    return mapActionError(error);
  }
}

const respondSchema = z.object({
  matchId: z.string().cuid(),
  decision: z.enum(['accept', 'reject']),
});

/**
 * Mentor/mentee responds to their own admin-approved match (§4: accept/reject
 * own). The first acceptance activates the pair; either party can reject.
 */
export async function respondToMatch(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { matchId, decision } = respondSchema.parse({
      matchId: formData.get('matchId'),
      decision: formData.get('decision'),
    });

    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });

    // Authorization: only the matched mentor or mentee may respond.
    const isParticipant = match.mentorId === user.id || match.menteeId === user.id;
    if (!isParticipant) {
      return fail({ code: 'FORBIDDEN', message: 'You are not part of this match.' });
    }
    const respondable: MatchStatus[] = [MatchStatus.ADMIN_APPROVED, MatchStatus.OVERRIDDEN];
    if (!respondable.includes(match.status)) {
      return fail({ code: 'CONFLICT', message: 'This match is not awaiting your response.' });
    }

    if (decision === 'accept') {
      await prisma.$transaction([
        prisma.match.update({
          where: { id: matchId },
          data: { status: MatchStatus.ACCEPTED, acceptedAt: new Date() },
        }),
        prisma.menteeProfile.updateMany({
          where: { userId: match.menteeId, cohortId: match.cohortId },
          data: { matchingStatus: MatchingStatus.MATCHED },
        }),
        prisma.mentorProfile.updateMany({
          where: { userId: match.mentorId, cohortId: match.cohortId },
          data: { matchingStatus: MatchingStatus.MATCHED },
        }),
      ]);
    } else {
      await prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.REJECTED },
      });
    }

    await writeAuditLog({
      actorId: user.id,
      cohortId: match.cohortId,
      action: decision === 'accept' ? 'match.accepted' : 'match.rejected',
      entityType: 'Match',
      entityId: matchId,
      metadata: { role: match.mentorId === user.id ? 'mentor' : 'mentee' },
    });

    // Tell the other party the pairing is now active so it reflects on both
    // dashboards (a rejection is handled by the admin, who sees it in the engine).
    if (decision === 'accept') {
      const otherId = match.mentorId === user.id ? match.menteeId : match.mentorId;
      await notify({
        userId: otherId,
        type: 'match_accepted',
        params: { name: user.name ?? '' },
        link: '/pair',
        cohortId: match.cohortId,
      });
    }

    revalidatePath('/dashboard/mentor');
    revalidatePath('/dashboard/mentee');
    revalidatePath('/admin/matching');
    return ok({ id: matchId });
  } catch (error) {
    return mapActionError(error);
  }
}
