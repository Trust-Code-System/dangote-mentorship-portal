'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { GoalStage, GoalStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { notify } from '@/lib/notifications/notify';
import { getStorageProvider } from '@/lib/storage';
import { canUseDirectUploads, createSignedUploadTarget, removeStoredObject } from '@/lib/storage/direct';
import { verifyFileSignature } from '@/lib/files/sniff';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { getMenteePairing, isMentorOfGoal } from './data';
import { menteeAdvanceTransition, reviewTransition, type ReviewDecision } from './stage';
import { coachGoal, type CoachResult } from './coach';
import type { GoalDraftFields } from './smart';

// All goal mutations follow the CLAUDE.md §3 pipeline:
// authenticate → authorize → validate (Zod) → execute → audit → typed result.
// AI (the Goal Coach) only suggests; a human writes every row (§0 rule 5).

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

function emptyToNull(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Goal Coach (advisory; no DB write) ──────────────────────────────────────

const coachSchema = z.object({
  title: z.string().trim().max(200),
  competency: optionalText(120),
  whyMatters: optionalText(2000),
  currentLevel: optionalText(500),
  desiredLevel: optionalText(500),
  learningActivity: optionalText(2000),
  successMeasure: optionalText(1000),
  startDate: optionalText(40),
  endDate: optionalText(40),
});

export async function requestGoalCoach(
  input: GoalDraftFields,
): Promise<ActionResult<CoachResult>> {
  try {
    const user = await requireUser();
    const fields = coachSchema.parse(input);
    // Throttle the AI endpoint per user (production-readiness-report.md M1).
    if (!(await checkRateLimit(`ai:goal-coach:${user.id}`, 10, 60_000)).ok) {
      return fail({ code: 'CONFLICT', message: 'Too many AI requests. Please wait a moment.' });
    }
    // QA-I18N-006 follow-up: coach responds in the ACTIVE UI locale (header
    // switcher), not the saved account locale.
    const activeLocale = await getLocale();
    const lang = activeLocale.toLowerCase().startsWith('fr') ? 'FR' : 'EN';
    const result = await coachGoal(fields, lang);
    return ok(result);
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Create / edit (mentee, own draft) ───────────────────────────────────────

const saveSchema = z.object({
  goalId: z.string().cuid().optional(),
  title: z.string().trim().min(3).max(200),
  competency: optionalText(120),
  whyMatters: optionalText(2000),
  currentLevel: optionalText(500),
  desiredLevel: optionalText(500),
  learningActivity: optionalText(2000),
  successMeasure: optionalText(1000),
  startDate: optionalText(40),
  endDate: optionalText(40),
});

function saveDataFrom(form: FormData) {
  return {
    goalId: (form.get('goalId') as string) || undefined,
    title: form.get('title'),
    competency: form.get('competency'),
    whyMatters: form.get('whyMatters'),
    currentLevel: form.get('currentLevel'),
    desiredLevel: form.get('desiredLevel'),
    learningActivity: form.get('learningActivity'),
    successMeasure: form.get('successMeasure'),
    startDate: form.get('startDate'),
    endDate: form.get('endDate'),
  };
}

/**
 * Create or update the mentee's own goal while it is still editable (DRAFT or a
 * REJECTED goal being revised). The cohort is taken from the mentee's accepted
 * pairing — a goal needs a mentor who can approve it.
 */
export async function saveGoal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = saveSchema.parse(saveDataFrom(formData));

    const fields = {
      title: data.title,
      competency: emptyToNull(data.competency),
      whyMatters: emptyToNull(data.whyMatters),
      currentLevel: emptyToNull(data.currentLevel),
      desiredLevel: emptyToNull(data.desiredLevel),
      learningActivity: emptyToNull(data.learningActivity),
      successMeasure: emptyToNull(data.successMeasure),
      startDate: parseDate(data.startDate),
      endDate: parseDate(data.endDate),
    };

    let goalId: string;
    if (data.goalId) {
      const goal = await prisma.goal.findUnique({ where: { id: data.goalId } });
      if (!goal || goal.deletedAt || goal.menteeId !== user.id) {
        return fail({ code: 'NOT_FOUND', message: 'Goal not found.' });
      }
      const editable: GoalStatus[] = [GoalStatus.DRAFT, GoalStatus.REJECTED];
      if (!editable.includes(goal.status)) {
        return fail({ code: 'CONFLICT', message: 'This goal can no longer be edited.' });
      }
      // Revising a rejected goal returns it to a clean draft.
      await prisma.goal.update({
        where: { id: goal.id },
        data: { ...fields, status: GoalStatus.DRAFT, stage: GoalStage.DRAFTED },
      });
      goalId = goal.id;
    } else {
      const pairing = await getMenteePairing(user.id);
      if (!pairing) {
        return fail({
          code: 'FORBIDDEN',
          message: 'Goals unlock once you and your mentor have accepted your match.',
        });
      }
      const created = await prisma.goal.create({
        data: {
          cohortId: pairing.cohortId,
          menteeId: user.id,
          status: GoalStatus.DRAFT,
          stage: GoalStage.DRAFTED,
          ...fields,
        },
      });
      goalId = created.id;
    }

    await writeAuditLog({
      actorId: user.id,
      action: data.goalId ? 'goal.updated' : 'goal.created',
      entityType: 'Goal',
      entityId: goalId,
    });

    revalidatePath('/goals');
    return ok({ id: goalId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Submit for review (mentee) ──────────────────────────────────────────────

const idSchema = z.object({ goalId: z.string().cuid() });

export async function submitGoal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { goalId } = idSchema.parse({ goalId: formData.get('goalId') });

    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.deletedAt || goal.menteeId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Goal not found.' });
    }
    const submittable: GoalStatus[] = [GoalStatus.DRAFT, GoalStatus.REJECTED];
    if (!submittable.includes(goal.status)) {
      return fail({ code: 'CONFLICT', message: 'This goal is not in a state that can be submitted.' });
    }

    await prisma.goal.update({
      where: { id: goalId },
      data: { status: GoalStatus.SUBMITTED, stage: GoalStage.DRAFTED },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: goal.cohortId,
      action: 'goal.submitted',
      entityType: 'Goal',
      entityId: goalId,
    });

    // Tell the paired mentor a goal is awaiting their approval so it reflects on
    // their side (§1.10). Best-effort: an unpaired mentee simply has no mentor yet.
    const pairing = await getMenteePairing(user.id);
    if (pairing) {
      await notify({
        userId: pairing.mentorId,
        type: 'goal_submitted',
        params: { menteeName: user.name ?? '', goalTitle: goal.title },
        link: '/goals',
        cohortId: goal.cohortId,
      });
    }

    revalidatePath('/goals');
    return ok({ id: goalId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Review (mentor) ─────────────────────────────────────────────────────────

const reviewSchema = z.object({
  goalId: z.string().cuid(),
  decision: z.enum(['comment', 'approve', 'reject']),
  comment: optionalText(2000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

/**
 * Mentor reviews a paired mentee's submitted goal (CLAUDE.md §7: approval is a
 * human action that flips status). Approve / reject / comment are resolved by the
 * pure reviewTransition; a GoalReview row records the feedback per stage.
 */
export async function reviewGoal(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = reviewSchema.parse({
      goalId: formData.get('goalId'),
      decision: formData.get('decision'),
      comment: formData.get('comment'),
      rating: formData.get('rating') || undefined,
    });

    const goal = await prisma.goal.findUnique({ where: { id: data.goalId } });
    if (!goal || goal.deletedAt) {
      return fail({ code: 'NOT_FOUND', message: 'Goal not found.' });
    }
    if (!(await isMentorOfGoal(user.id, goal))) {
      return fail({ code: 'FORBIDDEN', message: 'You are not the mentor for this goal.' });
    }

    const next = reviewTransition(
      { status: goal.status, stage: goal.stage },
      data.decision as ReviewDecision,
    );
    if (!next) {
      return fail({ code: 'CONFLICT', message: 'This goal is not awaiting review.' });
    }

    const comment = emptyToNull(data.comment);
    await prisma.$transaction([
      prisma.goalReview.create({
        data: {
          goalId: goal.id,
          reviewerId: user.id,
          comment,
          rating: data.rating ?? null,
          stage: next.stage,
        },
      }),
      prisma.goal.update({
        where: { id: goal.id },
        data: {
          status: next.status,
          stage: next.stage,
          mentorComments: comment ?? goal.mentorComments,
          approvedById: data.decision === 'approve' ? user.id : goal.approvedById,
          approvedAt: data.decision === 'approve' ? new Date() : goal.approvedAt,
        },
      }),
    ]);

    await writeAuditLog({
      actorId: user.id,
      cohortId: goal.cohortId,
      action: `goal.${data.decision}`,
      entityType: 'Goal',
      entityId: goal.id,
      metadata: { menteeId: goal.menteeId, status: next.status, stage: next.stage },
    });

    // Notify the mentee that their mentor responded (§1.10).
    await notify({
      userId: goal.menteeId,
      type: 'goal_commented',
      params: { mentorName: user.name ?? '', goalTitle: goal.title },
      link: '/goals',
      cohortId: goal.cohortId,
    });

    revalidatePath('/goals');
    return ok({ id: goal.id });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Advance stage (mentee, post-approval) ───────────────────────────────────

const advanceSchema = z.object({
  goalId: z.string().cuid(),
  stage: z.nativeEnum(GoalStage),
});

export async function advanceGoalStage(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { goalId, stage } = advanceSchema.parse({
      goalId: formData.get('goalId'),
      stage: formData.get('stage'),
    });

    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.deletedAt || goal.menteeId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Goal not found.' });
    }

    const next = menteeAdvanceTransition({ status: goal.status, stage: goal.stage }, stage);
    if (!next) {
      return fail({ code: 'CONFLICT', message: 'That progress update is not allowed for this goal.' });
    }

    await prisma.goal.update({
      where: { id: goalId },
      data: { status: next.status, stage: next.stage },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: goal.cohortId,
      action: 'goal.stage_advanced',
      entityType: 'Goal',
      entityId: goalId,
      metadata: { stage: next.stage, status: next.status },
    });

    revalidatePath('/goals');
    return ok({ id: goalId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Evidence upload (mentee) ────────────────────────────────────────────────

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EVIDENCE_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
};

/** Storage key for a goal-evidence file. Random component keeps keys unguessable. */
function evidenceKey(cohortId: string, goalId: string, ext: string): string {
  return `goals/${cohortId}/${goalId}/${randomUUID()}${ext}`;
}

const evidenceUploadInput = z.object({
  goalId: z.string().cuid(),
  name: z.string().trim().min(1).max(200),
  type: z.string().trim(),
  size: z.number().int().positive().max(MAX_EVIDENCE_BYTES),
  note: optionalText(500),
});

async function persistGoalEvidence(input: {
  goal: { id: string; cohortId: string; stage: GoalStage };
  userId: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  note: string;
}): Promise<ActionResult<{ id: string }>> {
  const advanceStage =
    input.goal.stage === GoalStage.APPROVED || input.goal.stage === GoalStage.IN_PROGRESS;
  const evidence = await prisma.$transaction(async (tx) => {
    const row = await tx.goalEvidence.create({
      data: {
        goalId: input.goal.id,
        cohortId: input.goal.cohortId,
        uploadedById: input.userId,
        stage: GoalStage.EVIDENCE_SUBMITTED,
        fileName: input.fileName.slice(0, 200),
        url: input.key,
        mimeType: input.mimeType,
        size: input.size,
        note: emptyToNull(input.note),
      },
    });
    if (advanceStage) {
      await tx.goal.update({
        where: { id: input.goal.id },
        data: { stage: GoalStage.EVIDENCE_SUBMITTED },
      });
    }
    return row;
  });

  await writeAuditLog({
    actorId: input.userId,
    cohortId: input.goal.cohortId,
    action: 'goal.evidence_uploaded',
    entityType: 'GoalEvidence',
    entityId: evidence.id,
    metadata: { goalId: input.goal.id },
  });
  revalidatePath('/goals');
  return ok({ id: evidence.id });
}

export async function prepareGoalEvidenceUpload(input: {
  goalId: string;
  name: string;
  type: string;
  size: number;
  note?: string;
}): Promise<ActionResult<{ mode: 'direct'; bucket: string; path: string; token: string } | { mode: 'server' }>> {
  try {
    const user = await requireUser();
    const file = evidenceUploadInput.parse({ ...input, note: input.note ?? '' });
    const goal = await prisma.goal.findUnique({ where: { id: file.goalId } });
    if (!goal || goal.deletedAt || goal.menteeId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Goal not found.' });
    }
    if (goal.status !== GoalStatus.APPROVED && goal.status !== GoalStatus.COMPLETED) {
      return fail({ code: 'CONFLICT', message: 'You can add evidence once your goal is approved.' });
    }
    const ext = ALLOWED_EVIDENCE_TYPES[file.type];
    if (!ext) return fail({ code: 'VALIDATION', message: 'Unsupported file type.' });
    if (!canUseDirectUploads()) return ok({ mode: 'server' });
    const target = await createSignedUploadTarget(evidenceKey(goal.cohortId, goal.id, ext));
    return ok({ mode: 'direct', ...target });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function confirmGoalEvidenceUpload(input: {
  goalId: string;
  path: string;
  name: string;
  type: string;
  size: number;
  note?: string;
}): Promise<GoalActionState> {
  try {
    const user = await requireUser();
    const file = evidenceUploadInput.parse({ ...input, note: input.note ?? '' });
    const goal = await prisma.goal.findUnique({ where: { id: file.goalId } });
    if (!goal || goal.deletedAt || goal.menteeId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Goal not found.' });
    }
    if (goal.status !== GoalStatus.APPROVED && goal.status !== GoalStatus.COMPLETED) {
      return fail({ code: 'CONFLICT', message: 'You can add evidence once your goal is approved.' });
    }
    const ext = ALLOWED_EVIDENCE_TYPES[file.type];
    const expectedPrefix = `goals/${goal.cohortId}/${goal.id}/`;
    if (!ext || !input.path.startsWith(expectedPrefix) || !input.path.endsWith(ext)) {
      return fail({ code: 'FORBIDDEN', message: 'The upload target is not valid for this goal.' });
    }
    const bytes = await getStorageProvider().get(input.path);
    if (bytes.byteLength !== file.size || !verifyFileSignature(bytes, file.type)) {
      await removeStoredObject(input.path);
      return fail({ code: 'VALIDATION', message: "File contents don't match its type." });
    }
    return persistGoalEvidence({
      goal,
      userId: user.id,
      key: input.path,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      note: file.note ?? '',
    });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadGoalEvidence(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { goalId } = idSchema.parse({ goalId: formData.get('goalId') });
    const note = optionalText(500).parse(formData.get('note') ?? '');

    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.deletedAt || goal.menteeId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Goal not found.' });
    }
    // Evidence belongs to the working phase: the goal must be approved.
    if (goal.status !== GoalStatus.APPROVED && goal.status !== GoalStatus.COMPLETED) {
      return fail({ code: 'CONFLICT', message: 'You can add evidence once your goal is approved.' });
    }

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return fail({ code: 'VALIDATION', message: 'Choose a file to upload.' });
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      return fail({ code: 'VALIDATION', message: 'File is too large (max 10 MB).' });
    }
    const ext = ALLOWED_EVIDENCE_TYPES[file.type];
    if (!ext) {
      return fail({ code: 'VALIDATION', message: 'Unsupported file type.' });
    }

    const key = evidenceKey(goal.cohortId, goal.id, ext);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Don't trust the browser-supplied MIME: confirm the bytes match the format
    // before anything is persisted (production-readiness-report.md M1).
    if (!verifyFileSignature(bytes, file.type)) {
      return fail({ code: 'VALIDATION', message: "File contents don't match its type." });
    }
    await getStorageProvider().put({ key, bytes, contentType: file.type });

    return persistGoalEvidence({
      goal,
      userId: user.id,
      key,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      note: note ?? '',
    });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── useActionState / void wrappers for RSC <form action> usage ──────────────

export type GoalActionState = ActionResult<{ id: string }> | null;

export async function saveGoalForm(_prev: GoalActionState, formData: FormData): Promise<GoalActionState> {
  return saveGoal(formData);
}
export async function reviewGoalForm(_prev: GoalActionState, formData: FormData): Promise<GoalActionState> {
  return reviewGoal(formData);
}
export async function uploadGoalEvidenceForm(
  _prev: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  return uploadGoalEvidence(formData);
}
export async function submitGoalAction(formData: FormData): Promise<void> {
  await submitGoal(formData);
}
export async function advanceGoalStageAction(formData: FormData): Promise<void> {
  await advanceGoalStage(formData);
}
