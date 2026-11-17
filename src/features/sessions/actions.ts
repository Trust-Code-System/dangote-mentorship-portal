'use server';

import { revalidatePath } from 'next/cache';
import { revalidateMentorshipProgress } from '@/features/journey/revalidate';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { ActionItemStatus, MeetingType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser, requireRole } from '@/lib/auth/rbac';
import { getMenteePairing, isAcceptedPair } from '@/lib/pairings';
import { requirePortalAccess } from '@/features/assessments/guard';
import { writeAuditLog } from '@/lib/audit/audit';
import { notify } from '@/lib/notifications/notify';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { getPairGoalTitles } from './data';
import { summarizeSession, type SessionSummaryOutcome } from './summary';

// User-confirmed workflow: mentees record sessions, mentors add reflections.
// Actor and pairing come from the server. Historical authorship is preserved.

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

function emptyToNull(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function canRecordLog(
  userId: string,
  log: { recordedById: string | null; menteeId: string; mentorId: string; cohortId: string },
) {
  return (
    log.menteeId === userId &&
    log.recordedById === userId &&
    isAcceptedPair(log.mentorId, userId, log.cohortId)
  );
}

// ── Session Assistant (advisory; no DB write) ───────────────────────────────

const assistantSchema = z.object({
  notes: z.string().trim().min(1).max(8000),
});

export async function requestSessionAssistant(input: {
  notes: string;
}): Promise<ActionResult<SessionSummaryOutcome>> {
  try {
    const user = await requireRole('MENTEE');
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const { notes } = assistantSchema.parse(input);
    const pairing = await getMenteePairing(user.id);
    if (!pairing) {
      return fail({ code: 'FORBIDDEN', message: 'An accepted mentor pairing is required.' });
    }
    // Throttle the AI endpoint per user (production-readiness-report.md M1).
    if (!(await checkRateLimit(`ai:session-assistant:${user.id}`, 10, 60_000)).ok) {
      return fail({ code: 'CONFLICT', message: 'Too many AI requests. Please wait a moment.' });
    }

    const [goalTitles, mentee] = await Promise.all([
      getPairGoalTitles(user.id, pairing.cohortId),
      prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    ]);
    // QA-I18N-006 follow-up: summarize in the ACTIVE UI locale, not account locale.
    const activeLocale = await getLocale();
    const lang = activeLocale.toLowerCase().startsWith('fr') ? 'FR' : 'EN';
    const outcome = await summarizeSession(notes, { goalTitles, menteeName: mentee?.name }, lang);
    return ok(outcome);
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Save session log (mentee) ───────────────────────────────────────────────

const suggestedItemSchema = z.object({
  task: z.string().trim().min(1).max(300),
  assignee: z.enum(['mentee', 'mentor', 'none']).default('mentee'),
  due: z.string().trim().max(40).optional(),
});

const saveSchema = z.object({
  logId: z.string().cuid().optional(),
  date: optionalText(40),
  time: optionalText(20),
  meetingType: z.nativeEnum(MeetingType).optional(),
  competencyDiscussed: optionalText(200),
  goalDiscussed: optionalText(200),
  discussionSummary: optionalText(5000),
  actionsAgreed: optionalText(3000),
  challenges: optionalText(3000),
  resourcesNeeded: optionalText(2000),
  nextActionPlan: optionalText(3000),
  timeline: optionalText(500),
  nextMeetingDate: optionalText(40),
  aiSummary: optionalText(5000),
  // JSON array of suggested/edited action items to create with a new log.
  actionItems: z.string().optional(),
});

function parseSuggestedItems(raw: string | undefined) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const arr = z.array(suggestedItemSchema).max(20).safeParse(parsed);
    return arr.success ? arr.data : [];
  } catch {
    return [];
  }
}

/**
 * Create or edit a session log. The mentee must have an accepted mentor pairing;
 * editing also requires recorded authorship. Any structured action
 * items supplied (typically AI-extracted then human-edited) are created with the
 * log and assigned to the mentor or mentee.
 */
export async function saveSessionLog(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole('MENTEE');
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const data = saveSchema.parse({
      logId: (formData.get('logId') as string) || undefined,
      date: formData.get('date'),
      time: formData.get('time'),
      meetingType: (formData.get('meetingType') as string) || undefined,
      competencyDiscussed: formData.get('competencyDiscussed'),
      goalDiscussed: formData.get('goalDiscussed'),
      discussionSummary: formData.get('discussionSummary'),
      actionsAgreed: formData.get('actionsAgreed'),
      challenges: formData.get('challenges'),
      resourcesNeeded: formData.get('resourcesNeeded'),
      nextActionPlan: formData.get('nextActionPlan'),
      timeline: formData.get('timeline'),
      nextMeetingDate: formData.get('nextMeetingDate'),
      aiSummary: formData.get('aiSummary'),
      actionItems: (formData.get('actionItems') as string) || undefined,
    });

    const fields = {
      date: parseDate(data.date),
      time: emptyToNull(data.time),
      meetingType: data.meetingType ?? null,
      competencyDiscussed: emptyToNull(data.competencyDiscussed),
      goalDiscussed: emptyToNull(data.goalDiscussed),
      discussionSummary: emptyToNull(data.discussionSummary),
      actionsAgreed: emptyToNull(data.actionsAgreed),
      challenges: emptyToNull(data.challenges),
      resourcesNeeded: emptyToNull(data.resourcesNeeded),
      nextActionPlan: emptyToNull(data.nextActionPlan),
      timeline: emptyToNull(data.timeline),
      nextMeetingDate: parseDate(data.nextMeetingDate),
      aiSummary: emptyToNull(data.aiSummary),
    };

    if (data.logId) {
      const log = await prisma.sessionLog.findUnique({ where: { id: data.logId } });
      if (!log || log.deletedAt || !(await canRecordLog(user.id, log))) {
        return fail({ code: 'NOT_FOUND', message: 'Session log not found.' });
      }
      await prisma.sessionLog.update({ where: { id: log.id }, data: fields });
      await writeAuditLog({
        actorId: user.id,
        cohortId: log.cohortId,
        action: 'session_log.updated',
        entityType: 'SessionLog',
        entityId: log.id,
      });
      revalidatePath('/sessions');
      revalidateMentorshipProgress();
      return ok({ id: log.id });
    }

    // Create
    const pairing = await getMenteePairing(user.id);
    if (!pairing) {
      return fail({ code: 'FORBIDDEN', message: 'An accepted mentor pairing is required.' });
    }
    const { cohortId, mentorId } = pairing;

    const items = parseSuggestedItems(data.actionItems);
    const log = await prisma.$transaction(async (tx) => {
      const created = await tx.sessionLog.create({
        data: { cohortId, mentorId, menteeId: user.id, recordedById: user.id, ...fields },
      });
      for (const item of items) {
        const assigneeId =
          item.assignee === 'mentor' ? mentorId : item.assignee === 'mentee' ? user.id : null;
        await tx.actionItem.create({
          data: {
            cohortId,
            sessionLogId: created.id,
            createdById: user.id,
            assigneeId,
            title: item.task,
            dueDate: parseDate(item.due),
          },
        });
      }
      return created;
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId,
      action: 'session_log.created',
      entityType: 'SessionLog',
      entityId: log.id,
      metadata: {
        menteeId: user.id,
        actionItems: items.length,
        aiSummary: Boolean(fields.aiSummary),
      },
    });

    // The paired mentor receives the shared log and can add their reflection.
    await notify({
      userId: mentorId,
      type: 'session_recorded',
      params: { menteeName: user.name ?? '' },
      link: '/sessions',
      cohortId,
    });

    revalidatePath('/sessions');
    revalidateMentorshipProgress();
    return ok({ id: log.id });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Mentor reflection ───────────────────────────────────────────────────────

const reflectionSchema = z.object({
  logId: z.string().cuid(),
  reflection: z.string().trim().max(5000),
});

export async function saveReflection(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole('MENTOR');
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const { logId, reflection } = reflectionSchema.parse({
      logId: formData.get('logId'),
      reflection: formData.get('reflection'),
    });

    const log = await prisma.sessionLog.findUnique({ where: { id: logId } });
    if (
      !log ||
      log.deletedAt ||
      log.mentorId !== user.id ||
      !(await isAcceptedPair(user.id, log.menteeId, log.cohortId))
    ) {
      return fail({ code: 'NOT_FOUND', message: 'Session log not found.' });
    }

    await prisma.sessionLog.update({
      where: { id: logId },
      data: { mentorReflection: emptyToNull(reflection) },
    });
    await writeAuditLog({
      actorId: user.id,
      cohortId: log.cohortId,
      action: 'session_log.reflection_saved',
      entityType: 'SessionLog',
      entityId: logId,
    });

    revalidatePath('/sessions');
    revalidateMentorshipProgress();
    return ok({ id: logId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Action items ────────────────────────────────────────────────────────────

const addItemSchema = z.object({
  sessionLogId: z.string().cuid(),
  title: z.string().trim().min(1).max(300),
  assignee: z.enum(['mentee', 'mentor', 'none']).default('mentee'),
  due: optionalText(40),
});

/** The mentee recorder adds an action item to their session log. */
export async function addActionItem(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole('MENTEE');
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const data = addItemSchema.parse({
      sessionLogId: formData.get('sessionLogId'),
      title: formData.get('title'),
      assignee: formData.get('assignee') ?? 'mentee',
      due: formData.get('due'),
    });

    const log = await prisma.sessionLog.findUnique({ where: { id: data.sessionLogId } });
    if (!log || log.deletedAt || !(await canRecordLog(user.id, log))) {
      return fail({ code: 'NOT_FOUND', message: 'Session log not found.' });
    }

    const assigneeId =
      data.assignee === 'mentor' ? log.mentorId : data.assignee === 'mentee' ? log.menteeId : null;

    const item = await prisma.actionItem.create({
      data: {
        cohortId: log.cohortId,
        sessionLogId: log.id,
        createdById: user.id,
        assigneeId,
        title: data.title,
        dueDate: parseDate(data.due),
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: log.cohortId,
      action: 'action_item.created',
      entityType: 'ActionItem',
      entityId: item.id,
      metadata: { sessionLogId: log.id },
    });

    revalidatePath('/sessions');
    revalidateMentorshipProgress();
    return ok({ id: item.id });
  } catch (error) {
    return mapActionError(error);
  }
}

const statusSchema = z.object({
  itemId: z.string().cuid(),
  status: z.nativeEnum(ActionItemStatus),
});

/**
 * Update an action item's status: its assignee or the mentee who recorded the log.
 */
export async function updateActionItemStatus(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const { itemId, status } = statusSchema.parse({
      itemId: formData.get('itemId'),
      status: formData.get('status'),
    });

    const item = await prisma.actionItem.findUnique({
      where: { id: itemId },
      include: {
        sessionLog: {
          select: {
            mentorId: true,
            menteeId: true,
            cohortId: true,
            recordedById: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!item || item.deletedAt) {
      return fail({ code: 'NOT_FOUND', message: 'Action item not found.' });
    }

    const isAssignee = item.assigneeId === user.id;
    const isRecorder =
      user.roles.includes('MENTEE') &&
      item.sessionLog &&
      !item.sessionLog.deletedAt &&
      (await canRecordLog(user.id, item.sessionLog));
    if (!isAssignee && !isRecorder) {
      return fail({ code: 'FORBIDDEN', message: 'You cannot update this action item.' });
    }

    await prisma.actionItem.update({ where: { id: itemId }, data: { status } });
    await writeAuditLog({
      actorId: user.id,
      cohortId: item.cohortId,
      action: 'action_item.status_changed',
      entityType: 'ActionItem',
      entityId: itemId,
      metadata: { status },
    });

    revalidatePath('/sessions');
    revalidateMentorshipProgress();
    return ok({ id: itemId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── useActionState / void wrappers ──────────────────────────────────────────

export type SessionActionState = ActionResult<{ id: string }> | null;

export async function saveSessionLogForm(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  return saveSessionLog(formData);
}
export async function saveReflectionForm(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  return saveReflection(formData);
}
export async function addActionItemForm(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  return addActionItem(formData);
}
export async function updateActionItemStatusAction(formData: FormData): Promise<void> {
  await updateActionItemStatus(formData);
}
