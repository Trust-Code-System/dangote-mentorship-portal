'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { ActionItemStatus, MeetingType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { notify } from '@/lib/notifications/notify';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { getPairGoalTitles } from './data';
import { summarizeSession, type SessionSummaryOutcome } from './summary';

// Session logging follows the CLAUDE.md §3 pipeline. Per §4: mentors create/edit
// their own logs; mentees reflect on their own. The Session Assistant only
// suggests — the mentor edits and saves (CLAUDE.md §0 rule 5).

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

function emptyToNull(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The mentor's accepted pairing for a given mentee, or null if not paired. */
async function mentorPairCohort(mentorId: string, menteeId: string): Promise<string | null> {
  const match = await prisma.match.findFirst({
    where: { mentorId, menteeId, status: 'ACCEPTED', deletedAt: null },
    orderBy: { acceptedAt: 'desc' },
    select: { cohortId: true },
  });
  return match?.cohortId ?? null;
}

// ── Session Assistant (advisory; no DB write) ───────────────────────────────

const assistantSchema = z.object({
  menteeId: z.string().cuid(),
  notes: z.string().trim().min(1).max(8000),
});

export async function requestSessionAssistant(
  input: { menteeId: string; notes: string },
): Promise<ActionResult<SessionSummaryOutcome>> {
  try {
    const user = await requireUser();
    const { menteeId, notes } = assistantSchema.parse(input);

    const cohortId = await mentorPairCohort(user.id, menteeId);
    if (!cohortId) {
      return fail({ code: 'FORBIDDEN', message: 'You are not paired with this mentee.' });
    }
    // Throttle the AI endpoint per user (production-readiness-report.md M1).
    if (!(await checkRateLimit(`ai:session-assistant:${user.id}`, 10, 60_000)).ok) {
      return fail({ code: 'CONFLICT', message: 'Too many AI requests. Please wait a moment.' });
    }

    const [goalTitles, mentee] = await Promise.all([
      getPairGoalTitles(menteeId, cohortId),
      prisma.user.findUnique({ where: { id: menteeId }, select: { name: true } }),
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

// ── Save session log (mentor) ───────────────────────────────────────────────

const suggestedItemSchema = z.object({
  task: z.string().trim().min(1).max(300),
  assignee: z.enum(['mentee', 'mentor', 'none']).default('mentee'),
  due: z.string().trim().max(40).optional(),
});

const saveSchema = z.object({
  logId: z.string().cuid().optional(),
  menteeId: z.string().cuid().optional(),
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
  mentorNotes: optionalText(3000),
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
 * Create or edit a session log (CLAUDE.md §6.9). On create the mentor must be
 * paired with the mentee; on edit they must own the log. Any structured action
 * items supplied (typically AI-extracted then human-edited) are created with the
 * log and assigned to the mentor or mentee.
 */
export async function saveSessionLog(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = saveSchema.parse({
      logId: (formData.get('logId') as string) || undefined,
      menteeId: (formData.get('menteeId') as string) || undefined,
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
      mentorNotes: formData.get('mentorNotes'),
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
      mentorNotes: emptyToNull(data.mentorNotes),
      aiSummary: emptyToNull(data.aiSummary),
    };

    if (data.logId) {
      const log = await prisma.sessionLog.findUnique({ where: { id: data.logId } });
      if (!log || log.deletedAt || log.mentorId !== user.id) {
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
      return ok({ id: log.id });
    }

    // Create
    if (!data.menteeId) {
      return fail({ code: 'VALIDATION', message: 'Choose which mentee this session is with.' });
    }
    const cohortId = await mentorPairCohort(user.id, data.menteeId);
    if (!cohortId) {
      return fail({ code: 'FORBIDDEN', message: 'You are not paired with this mentee.' });
    }

    const items = parseSuggestedItems(data.actionItems);
    const log = await prisma.$transaction(async (tx) => {
      const created = await tx.sessionLog.create({
        data: { cohortId, mentorId: user.id, menteeId: data.menteeId!, ...fields },
      });
      for (const item of items) {
        const assigneeId =
          item.assignee === 'mentor' ? user.id : item.assignee === 'mentee' ? data.menteeId! : null;
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
      metadata: { menteeId: data.menteeId, actionItems: items.length, aiSummary: Boolean(fields.aiSummary) },
    });

    // Tell the mentee a session log was added so it reflects on their side and
    // prompts their reflection (§1.10). Mentor private notes stay private — the
    // notification only signals that the shared log exists.
    await notify({
      userId: data.menteeId,
      type: 'session_logged',
      params: { mentorName: user.name ?? '' },
      link: '/sessions',
      cohortId,
    });

    revalidatePath('/sessions');
    return ok({ id: log.id });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Mentee reflection ───────────────────────────────────────────────────────

const reflectionSchema = z.object({
  logId: z.string().cuid(),
  reflection: z.string().trim().max(5000),
});

export async function saveReflection(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { logId, reflection } = reflectionSchema.parse({
      logId: formData.get('logId'),
      reflection: formData.get('reflection'),
    });

    const log = await prisma.sessionLog.findUnique({ where: { id: logId } });
    if (!log || log.deletedAt || log.menteeId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Session log not found.' });
    }

    await prisma.sessionLog.update({
      where: { id: logId },
      data: { menteeReflection: emptyToNull(reflection) },
    });
    await writeAuditLog({
      actorId: user.id,
      cohortId: log.cohortId,
      action: 'session_log.reflection_saved',
      entityType: 'SessionLog',
      entityId: logId,
    });

    revalidatePath('/sessions');
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

/** Mentor adds an action item to one of their session logs. */
export async function addActionItem(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = addItemSchema.parse({
      sessionLogId: formData.get('sessionLogId'),
      title: formData.get('title'),
      assignee: formData.get('assignee') ?? 'mentee',
      due: formData.get('due'),
    });

    const log = await prisma.sessionLog.findUnique({ where: { id: data.sessionLogId } });
    if (!log || log.deletedAt || log.mentorId !== user.id) {
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
 * Update an action item's status. Allowed for the assignee or the pair's mentor
 * (the creator of the log). Lets a mentee mark their own task done/blocked.
 */
export async function updateActionItemStatus(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { itemId, status } = statusSchema.parse({
      itemId: formData.get('itemId'),
      status: formData.get('status'),
    });

    const item = await prisma.actionItem.findUnique({
      where: { id: itemId },
      include: { sessionLog: { select: { mentorId: true, menteeId: true, cohortId: true } } },
    });
    if (!item || item.deletedAt) {
      return fail({ code: 'NOT_FOUND', message: 'Action item not found.' });
    }

    const isAssignee = item.assigneeId === user.id;
    const isMentor = item.sessionLog?.mentorId === user.id;
    if (!isAssignee && !isMentor) {
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
