'use server';

import { revalidatePath } from 'next/cache';
import { NewsletterStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { assertCohortAccess, requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit/audit';
import { getAiAdapter } from '@/lib/ai';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { fail, mapActionError, ok, type ActionResult } from '@/lib/actions/result';
import { buildNewsletterDigest } from './digest';
import { buildDraftPrompt, mergeAssistantDraft, parseAssistantDraft } from './assistant';
import { getNewsletter, listCohortRecipients } from './data';
import { sendNewsletter } from './send';
import {
  createNewsletterSchema,
  emptyNewsletterBody,
  newsletterIdSchema,
  saveNewsletterSchema,
  scheduleSchema,
  scheduleSendSchema,
  sendableSections,
  type NewsletterBody,
} from './schema';

// Newsletter mutations (CLAUDE.md §10). Admin-only, cohort-scoped, audited.
//
// The one rule this file exists to protect: **the AI drafts, a human sends.**
// `requestNewsletterDraft` returns a suggestion and writes nothing.
// `approveNewsletter` is the human gate — dispatch refuses any issue without an
// `approvedAt` (see send.ts), so there is no path from an AI draft to an inbox
// that does not pass through an admin pressing approve.

function revalidateNewsletterPaths(id?: string): void {
  revalidatePath('/admin/newsletters');
  if (id) revalidatePath(`/admin/newsletters/${id}`);
}

export async function createNewsletter(
  formData: FormData,
): Promise<ActionResult<{ newsletterId: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const input = createNewsletterSchema.parse({
      cohortId: formData.get('cohortId'),
      title: formData.get('title'),
    });
    assertCohortAccess(user, input.cohortId);

    const newsletter = await prisma.newsletter.create({
      data: {
        cohortId: input.cohortId,
        createdById: user.id,
        title: input.title,
        status: NewsletterStatus.DRAFT,
        bodyJson: emptyNewsletterBody() as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: input.cohortId,
      action: 'newsletter.created',
      entityType: 'Newsletter',
      entityId: newsletter.id,
      metadata: { title: input.title },
    });

    revalidateNewsletterPaths(newsletter.id);
    return ok({ newsletterId: newsletter.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/**
 * Ask the Newsletter Assistant to fill the draft from real portal activity.
 * Returns a suggested body — nothing is saved until the admin saves it.
 */
export async function requestNewsletterDraft(
  formData: FormData,
): Promise<ActionResult<{ body: NewsletterBody; subjectEn: string; subjectFr: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const { newsletterId } = newsletterIdSchema.parse({
      newsletterId: formData.get('newsletterId'),
    });

    if (!(await checkRateLimit(`ai:newsletter-draft:${user.id}`, 10, 60_000)).ok) {
      return fail({ code: 'CONFLICT', message: 'Too many AI requests. Please wait a moment.' });
    }

    const newsletter = await getNewsletter(user, newsletterId);
    if (!newsletter) return fail({ code: 'NOT_FOUND', message: 'Newsletter not found.' });
    if (newsletter.status === NewsletterStatus.SENT) {
      return fail({ code: 'CONFLICT', message: 'This issue has already been sent.' });
    }

    const ai = getAiAdapter();
    if (!ai.enabled) {
      return fail({ code: 'CONFLICT', message: 'The AI drafter is not configured.' });
    }

    const digest = await buildNewsletterDigest(newsletter.cohortId);
    if (!digest) return fail({ code: 'NOT_FOUND', message: 'Cohort not found.' });

    const { system, prompt } = buildDraftPrompt(digest);
    const raw = await ai.complete({ system, prompt, temperature: 0.4, maxTokens: 3000 });
    const draft = parseAssistantDraft(raw);
    if (!draft) {
      return fail({
        code: 'CONFLICT',
        message: 'The AI drafter returned nothing usable. Try again.',
      });
    }

    const body = mergeAssistantDraft(newsletter.body ?? emptyNewsletterBody(), draft);

    await writeAuditLog({
      actorId: user.id,
      cohortId: newsletter.cohortId,
      action: 'newsletter.draft_suggested',
      entityType: 'Newsletter',
      entityId: newsletter.id,
      metadata: { model: ai.id, sections: draft.sections.length },
    });

    return ok({
      body,
      subjectEn: draft.subjectEn || (newsletter.subjectEn ?? ''),
      subjectFr: draft.subjectFr || (newsletter.subjectFr ?? ''),
    });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Save the composer's content. Editing a sent issue is refused. */
export async function saveNewsletter(
  formData: FormData,
): Promise<ActionResult<{ newsletterId: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const input = saveNewsletterSchema.parse({
      newsletterId: formData.get('newsletterId'),
      title: formData.get('title'),
      subjectEn: formData.get('subjectEn'),
      subjectFr: formData.get('subjectFr'),
      body: formData.get('body'),
    });

    const newsletter = await getNewsletter(user, input.newsletterId);
    if (!newsletter) return fail({ code: 'NOT_FOUND', message: 'Newsletter not found.' });
    if (newsletter.status === NewsletterStatus.SENT) {
      return fail({ code: 'CONFLICT', message: 'A sent issue can no longer be edited.' });
    }

    const aiDrafted = formData.get('aiDrafted') === 'true';

    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: {
        title: input.title,
        subjectEn: input.subjectEn,
        subjectFr: input.subjectFr,
        bodyJson: input.body as unknown as Prisma.InputJsonValue,
        // Editing an approved issue withdraws the approval: what was approved
        // is not what would now be sent.
        ...(newsletter.approvedAt
          ? { approvedAt: null, approvedById: null, status: NewsletterStatus.DRAFT }
          : {}),
        ...(aiDrafted ? { aiDrafted: true } : {}),
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: newsletter.cohortId,
      action: aiDrafted ? 'newsletter.ai_draft_accepted' : 'newsletter.edited',
      entityType: 'Newsletter',
      entityId: newsletter.id,
      metadata: { sections: input.body.sections.length, approvalWithdrawn: !!newsletter.approvedAt },
    });

    revalidateNewsletterPaths(newsletter.id);
    return ok({ newsletterId: newsletter.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/**
 * The human gate. Records who approved the issue and when, and sets the send
 * time. Nothing can reach an inbox without this (send.ts refuses an issue with
 * no `approvedAt`).
 */
export async function approveNewsletter(
  formData: FormData,
): Promise<ActionResult<{ id: string; scheduledAt: Date | null }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const input = scheduleSendSchema.parse({
      newsletterId: formData.get('newsletterId'),
      sendAt: formData.get('sendAt') || undefined,
    });

    const newsletter = await getNewsletter(user, input.newsletterId);
    if (!newsletter) return fail({ code: 'NOT_FOUND', message: 'Newsletter not found.' });
    if (newsletter.status === NewsletterStatus.SENT) {
      return fail({ code: 'CONFLICT', message: 'This issue has already been sent.' });
    }
    if (!newsletter.body || sendableSections(newsletter.body).length === 0) {
      return fail({ code: 'CONFLICT', message: 'Write some content before approving.' });
    }
    if (!newsletter.subjectEn || !newsletter.subjectFr) {
      return fail({
        code: 'CONFLICT',
        message: 'Add both the English and French subject lines before approving.',
      });
    }

    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: {
        status: NewsletterStatus.SCHEDULED,
        approvedById: user.id,
        approvedAt: new Date(),
        scheduledAt: input.sendAt,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: newsletter.cohortId,
      action: 'newsletter.approved',
      entityType: 'Newsletter',
      entityId: newsletter.id,
      metadata: { scheduledAt: input.sendAt?.toISOString() ?? null },
    });

    revalidateNewsletterPaths(newsletter.id);
    return ok({ id: newsletter.id, scheduledAt: input.sendAt });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Take an approved issue back to draft (before it is sent). */
export async function unapproveNewsletter(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const { newsletterId } = newsletterIdSchema.parse({
      newsletterId: formData.get('newsletterId'),
    });

    const newsletter = await getNewsletter(user, newsletterId);
    if (!newsletter) return fail({ code: 'NOT_FOUND', message: 'Newsletter not found.' });
    if (newsletter.status === NewsletterStatus.SENT) {
      return fail({ code: 'CONFLICT', message: 'This issue has already been sent.' });
    }

    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: {
        status: NewsletterStatus.DRAFT,
        approvedById: null,
        approvedAt: null,
        scheduledAt: null,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: newsletter.cohortId,
      action: 'newsletter.unapproved',
      entityType: 'Newsletter',
      entityId: newsletter.id,
    });

    revalidateNewsletterPaths(newsletter.id);
    return ok({ id: newsletter.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Send an approved issue right now. Explicitly triggered by an admin. */
export async function sendNewsletterNow(
  formData: FormData,
): Promise<ActionResult<{ sent: number; failed: number; skipped: number }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const { newsletterId } = newsletterIdSchema.parse({
      newsletterId: formData.get('newsletterId'),
    });

    const newsletter = await getNewsletter(user, newsletterId);
    if (!newsletter) return fail({ code: 'NOT_FOUND', message: 'Newsletter not found.' });
    if (!newsletter.approvedAt) {
      return fail({ code: 'CONFLICT', message: 'Approve the issue before sending it.' });
    }
    if (newsletter.status === NewsletterStatus.SENT) {
      return fail({ code: 'CONFLICT', message: 'This issue has already been sent.' });
    }

    const result = await sendNewsletter(newsletter.id);

    await writeAuditLog({
      actorId: user.id,
      cohortId: newsletter.cohortId,
      action: 'newsletter.sent',
      entityType: 'Newsletter',
      entityId: newsletter.id,
      metadata: { ...result, trigger: 'manual' },
    });

    revalidateNewsletterPaths(newsletter.id);
    return ok(result);
  } catch (error) {
    return mapActionError(error);
  }
}

/** Soft-delete a draft. Sent issues are kept as a record. */
export async function archiveNewsletter(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const { newsletterId } = newsletterIdSchema.parse({
      newsletterId: formData.get('newsletterId'),
    });

    const newsletter = await getNewsletter(user, newsletterId);
    if (!newsletter) return fail({ code: 'NOT_FOUND', message: 'Newsletter not found.' });
    if (newsletter.status === NewsletterStatus.SENT) {
      return fail({ code: 'CONFLICT', message: 'A sent issue is kept as a record.' });
    }

    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: newsletter.cohortId,
      action: 'newsletter.archived',
      entityType: 'Newsletter',
      entityId: newsletter.id,
    });

    revalidateNewsletterPaths();
    return ok({ id: newsletter.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Save the recurring cadence (e.g. Monday + Thursday at 09:00 Lagos). */
export async function saveNewsletterSchedule(
  formData: FormData,
): Promise<ActionResult<{ cohortId: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const input = scheduleSchema.parse({
      cohortId: formData.get('cohortId'),
      enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true',
      sendDays: formData.getAll('sendDays'),
      sendHour: formData.get('sendHour'),
      timezone: formData.get('timezone'),
      autoDraft: formData.get('autoDraft') === 'on' || formData.get('autoDraft') === 'true',
    });
    assertCohortAccess(user, input.cohortId);

    if (input.enabled && input.sendDays.length === 0) {
      return fail({
        code: 'VALIDATION',
        message: 'Choose at least one day to prepare the newsletter on.',
        fieldErrors: { sendDays: ['Choose at least one day.'] },
      });
    }

    const days = Array.from(new Set(input.sendDays)).sort((a, b) => a - b);

    await prisma.newsletterSchedule.upsert({
      where: { cohortId: input.cohortId },
      update: {
        enabled: input.enabled,
        sendDays: days,
        sendHour: input.sendHour,
        timezone: input.timezone,
        autoDraft: input.autoDraft,
        deletedAt: null,
      },
      create: {
        cohortId: input.cohortId,
        enabled: input.enabled,
        sendDays: days,
        sendHour: input.sendHour,
        timezone: input.timezone,
        autoDraft: input.autoDraft,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: input.cohortId,
      action: 'newsletter_schedule.saved',
      entityType: 'NewsletterSchedule',
      metadata: {
        enabled: input.enabled,
        sendDays: days,
        sendHour: input.sendHour,
        timezone: input.timezone,
        autoDraft: input.autoDraft,
      },
    });

    revalidateNewsletterPaths();
    return ok({ cohortId: input.cohortId });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Recipient count for the composer's "this goes to N people" line. */
export async function countNewsletterRecipients(
  cohortId: string,
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    assertCohortAccess(user, cohortId);
    const recipients = await listCohortRecipients(cohortId);
    return ok({ count: recipients.length });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── useActionState wrappers ─────────────────────────────────────────────────

export type CreateNewsletterState = ActionResult<{ newsletterId: string }> | null;
export type DraftState = ActionResult<{
  body: NewsletterBody;
  subjectEn: string;
  subjectFr: string;
}> | null;
export type SaveNewsletterState = ActionResult<{ newsletterId: string }> | null;
export type ApproveState = ActionResult<{ id: string; scheduledAt: Date | null }> | null;
export type NewsletterActionState = ActionResult<{ id: string }> | null;
export type SendState = ActionResult<{ sent: number; failed: number; skipped: number }> | null;
export type ScheduleState = ActionResult<{ cohortId: string }> | null;

export async function createNewsletterForm(
  _prev: CreateNewsletterState,
  formData: FormData,
): Promise<CreateNewsletterState> {
  return createNewsletter(formData);
}

export async function requestNewsletterDraftForm(
  _prev: DraftState,
  formData: FormData,
): Promise<DraftState> {
  return requestNewsletterDraft(formData);
}

export async function saveNewsletterForm(
  _prev: SaveNewsletterState,
  formData: FormData,
): Promise<SaveNewsletterState> {
  return saveNewsletter(formData);
}

export async function approveNewsletterForm(
  _prev: ApproveState,
  formData: FormData,
): Promise<ApproveState> {
  return approveNewsletter(formData);
}

export async function unapproveNewsletterForm(
  _prev: NewsletterActionState,
  formData: FormData,
): Promise<NewsletterActionState> {
  return unapproveNewsletter(formData);
}

export async function sendNewsletterNowForm(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  return sendNewsletterNow(formData);
}

export async function archiveNewsletterForm(
  _prev: NewsletterActionState,
  formData: FormData,
): Promise<NewsletterActionState> {
  return archiveNewsletter(formData);
}

export async function saveNewsletterScheduleForm(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  return saveNewsletterSchedule(formData);
}
