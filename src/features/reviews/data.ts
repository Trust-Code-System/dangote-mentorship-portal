import 'server-only';
import { ReviewStatus, ReviewType, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { SessionUser } from '@/lib/auth/rbac';
import { getMenteePairing, getMentorPairings } from '@/lib/pairings';
import { getActiveFormDefinition, type FormDefinitionDetail } from '@/features/forms/data';
import type { ReviewAnswers } from './schema';

// Reads for the review fill/submit flow (CLAUDE.md §5, M3). A respondent fills
// the active FormDefinition for a review type in their cohort, producing a
// FormResponse. Aggregation/roll-up and the AI Review Assistant are separate M3
// items — this file only serves the participant's own fill page.

/** The participant role + cohort a user fills a review as, or null when they
 *  aren't a paired participant (reviewers/admins use the aggregate view). */
export interface ReviewParticipant {
  cohortId: string;
  roleName: RoleName; // MENTOR | MENTEE
  subjectMenteeId?: string;
}

export async function resolveReviewParticipant(
  user: SessionUser,
  subjectMenteeId?: string,
): Promise<ReviewParticipant | null> {
  // A person is a mentor or a mentee in the loop, not both; prefer whichever
  // role has an accepted pairing so the cohort is unambiguous.
  if (user.roles.includes(RoleName.MENTEE) && !subjectMenteeId) {
    const pairing = await getMenteePairing(user.id);
    if (pairing) return { cohortId: pairing.cohortId, roleName: RoleName.MENTEE };
  }
  if (user.roles.includes(RoleName.MENTOR)) {
    const pairings = await getMentorPairings(user.id);
    const selected = subjectMenteeId
      ? pairings.find((p) => p.menteeId === subjectMenteeId)
      : pairings[0];
    if (selected)
      return {
        cohortId: selected.cohortId,
        roleName: RoleName.MENTOR,
        subjectMenteeId: selected.menteeId,
      };
  }
  return null;
}

export interface SubmittedReview {
  responseId: string;
  submittedAt: Date | null;
  answers: ReviewAnswers;
}

export interface ReviewAssignment {
  participant: ReviewParticipant;
  /** The active form for this review type/role, or null when none is published. */
  form: FormDefinitionDetail | null;
  /** The respondent's existing submission for that form, or null. */
  submitted: SubmittedReview | null;
}

/**
 * Everything the fill page needs: who the user fills as, the live form, and any
 * existing submission (so it can show the read-only confirmation and pre-fill an
 * update). Returns null when the user is not an eligible participant.
 */
export async function getReviewAssignment(
  user: SessionUser,
  type: ReviewType,
  subjectMenteeId?: string,
): Promise<ReviewAssignment | null> {
  const participant = await resolveReviewParticipant(user, subjectMenteeId);
  if (!participant) return null;

  const form = await getActiveFormDefinition(participant.cohortId, type, participant.roleName);
  if (!form) return { participant, form: null, submitted: null };

  const existing = await prisma.formResponse.findFirst({
    where: {
      formId: form.id,
      respondentId: user.id,
      subjectMenteeId:
        form.roleName === RoleName.MENTOR && form.schema.fields.some((f) => f.sourceQuestion)
          ? participant.subjectMenteeId
          : null,
      status: ReviewStatus.SUBMITTED,
      deletedAt: null,
    },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, submittedAt: true, answers: true },
  });

  return {
    participant,
    form,
    submitted: existing
      ? {
          responseId: existing.id,
          submittedAt: existing.submittedAt,
          answers: (existing.answers as ReviewAnswers) ?? {},
        }
      : null,
  };
}

/**
 * Find-or-create the cohort's review cycle container (MidtermReview /
 * FinalReview) so each FormResponse can link to it for later aggregation. There
 * is no admin "open review window" UI yet (separate item); the cycle is created
 * lazily on first submission.
 */
export async function ensureReviewCycle(cohortId: string, type: ReviewType): Promise<string> {
  if (type === ReviewType.MIDTERM) {
    const existing = await prisma.midtermReview.findFirst({
      where: { cohortId, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.midtermReview.create({
      data: { cohortId, status: ReviewStatus.IN_PROGRESS },
      select: { id: true },
    });
    return created.id;
  }

  const existing = await prisma.finalReview.findFirst({
    where: { cohortId, deletedAt: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.finalReview.create({
    data: { cohortId, status: ReviewStatus.IN_PROGRESS },
    select: { id: true },
  });
  return created.id;
}

/**
 * Whether a user has submitted a review of this type in a cohort — used to drive
 * the journey rail's review step from real data (experience-layer.md §1.2).
 */
export async function hasSubmittedReview(
  userId: string,
  cohortId: string,
  type: ReviewType,
): Promise<boolean> {
  const response = await prisma.formResponse.findFirst({
    where: {
      respondentId: userId,
      status: ReviewStatus.SUBMITTED,
      deletedAt: null,
      form: { cohortId, type, deletedAt: null },
    },
    select: { id: true },
  });
  return response !== null;
}
