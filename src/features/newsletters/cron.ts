import 'server-only';
import { CohortStatus, NewsletterStatus, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { writeAuditLog } from '@/lib/audit/audit';
import { getAiAdapter } from '@/lib/ai';
import { reportError } from '@/lib/observability/report';
import { notifyMany } from '@/lib/notifications/notify';
import { buildNewsletterDigest } from './digest';
import { buildDraftPrompt, mergeAssistantDraft, parseAssistantDraft } from './assistant';
import { sendNewsletter } from './send';
import { emptyNewsletterBody, isDraftDue, localDateKey } from './schema';

// The newsletter cron does two separate jobs, and the split is the whole point
// (CLAUDE.md §16 — "don't let AI send newsletters automatically"):
//
//   1. prepareScheduledDrafts() — on each scheduled day it creates a DRAFT,
//      optionally pre-filled by the assistant, and notifies the admins. It
//      never sends.
//   2. dispatchApprovedNewsletters() — sends issues an admin has already
//      approved and whose send time has passed. It never drafts.
//
// Both are idempotent: (1) records the local day it drafted for, (2) skips
// recipients already marked sent.

export interface NewsletterCronResult {
  draftsPrepared: number;
  aiDrafted: number;
  newslettersSent: number;
  recipientsSent: number;
  recipientsFailed: number;
}

/** Issue title for an auto-prepared draft, e.g. "Newsletter — 2026-09-07". */
function autoDraftTitle(now: Date, timezone: string): string {
  return `Newsletter — ${localDateKey(now, timezone)}`;
}

async function prepareScheduledDrafts(now: Date): Promise<{ prepared: number; ai: number }> {
  const schedules = await prisma.newsletterSchedule.findMany({
    where: {
      enabled: true,
      deletedAt: null,
      cohort: { deletedAt: null, status: CohortStatus.ACTIVE },
    },
    select: {
      id: true,
      cohortId: true,
      sendDays: true,
      sendHour: true,
      timezone: true,
      autoDraft: true,
      lastDraftedFor: true,
      enabled: true,
      cohort: { select: { name: true } },
    },
  });

  let prepared = 0;
  let ai = 0;

  for (const schedule of schedules) {
    if (
      !isDraftDue({
        enabled: schedule.enabled,
        sendDays: schedule.sendDays,
        sendHour: schedule.sendHour,
        timezone: schedule.timezone,
        lastDraftedFor: schedule.lastDraftedFor,
        now,
      })
    ) {
      continue;
    }

    // Claim the slot BEFORE doing the slow AI call, so two overlapping cron
    // runs cannot both create a draft for the same day.
    const claimed = await prisma.newsletterSchedule.updateMany({
      where: { id: schedule.id, lastDraftedFor: schedule.lastDraftedFor },
      data: { lastDraftedFor: now },
    });
    if (claimed.count === 0) continue;

    let body = emptyNewsletterBody();
    let subjectEn = '';
    let subjectFr = '';
    let aiDrafted = false;

    const adapter = getAiAdapter();
    if (schedule.autoDraft && adapter.enabled) {
      try {
        const digest = await buildNewsletterDigest(schedule.cohortId);
        if (digest) {
          const { system, prompt } = buildDraftPrompt(digest);
          const raw = await adapter.complete({
            system,
            prompt,
            temperature: 0.4,
            maxTokens: 3000,
          });
          const draft = parseAssistantDraft(raw);
          if (draft) {
            body = mergeAssistantDraft(body, draft);
            subjectEn = draft.subjectEn;
            subjectFr = draft.subjectFr;
            aiDrafted = true;
            ai += 1;
          }
        }
      } catch (error) {
        // A failed AI call must not cost the admin their draft — they get an
        // empty one to write themselves.
        reportError(error, { job: 'cron/newsletters', stage: 'ai-draft' });
      }
    }

    // The schedule has no human author, so the draft is attributed to an admin
    // of the cohort — the person who will review it.
    const admin = await prisma.userRole.findFirst({
      where: {
        deletedAt: null,
        role: { name: RoleName.SUPER_ADMIN },
        user: { isActive: true, deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (!admin) continue;

    const newsletter = await prisma.newsletter.create({
      data: {
        cohortId: schedule.cohortId,
        createdById: admin.userId,
        scheduleId: schedule.id,
        title: autoDraftTitle(now, schedule.timezone),
        subjectEn: subjectEn || null,
        subjectFr: subjectFr || null,
        status: NewsletterStatus.DRAFT,
        aiDrafted,
        bodyJson: body as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await writeAuditLog({
      cohortId: schedule.cohortId,
      action: 'newsletter.draft_prepared',
      entityType: 'Newsletter',
      entityId: newsletter.id,
      metadata: { scheduleId: schedule.id, aiDrafted, trigger: 'schedule' },
    });

    // Tell the admins there is something to review — a draft nobody knows about
    // is the same as no draft.
    const adminIds = await prisma.userRole.findMany({
      where: {
        deletedAt: null,
        role: { name: RoleName.SUPER_ADMIN },
        user: { isActive: true, deletedAt: null },
      },
      select: { userId: true },
    });
    await notifyMany(
      adminIds.map((row) => row.userId),
      {
        type: 'newsletter_draft_ready',
        params: { cohort: schedule.cohort.name },
        link: `/admin/newsletters/${newsletter.id}`,
        cohortId: schedule.cohortId,
      },
    );

    prepared += 1;
  }

  return { prepared, ai };
}

async function dispatchApprovedNewsletters(
  now: Date,
): Promise<{ newsletters: number; sent: number; failed: number }> {
  // Only issues a human approved, whose send time has arrived. `scheduledAt`
  // null means "send at the next dispatch".
  const due = await prisma.newsletter.findMany({
    where: {
      deletedAt: null,
      status: NewsletterStatus.SCHEDULED,
      approvedAt: { not: null },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    orderBy: { approvedAt: 'asc' },
    take: 10,
    select: { id: true, cohortId: true },
  });

  let newsletters = 0;
  let sent = 0;
  let failed = 0;

  for (const newsletter of due) {
    try {
      const result = await sendNewsletter(newsletter.id);
      sent += result.sent;
      failed += result.failed;
      if (result.sent > 0) newsletters += 1;

      await writeAuditLog({
        cohortId: newsletter.cohortId,
        action: 'newsletter.sent',
        entityType: 'Newsletter',
        entityId: newsletter.id,
        metadata: { ...result, trigger: 'schedule' },
      });
    } catch (error) {
      reportError(error, { job: 'cron/newsletters', newsletterId: newsletter.id });
      failed += 1;
    }
  }

  return { newsletters, sent, failed };
}

export async function runNewsletterCron(now = new Date()): Promise<NewsletterCronResult> {
  const drafts = await prepareScheduledDrafts(now);
  const dispatch = await dispatchApprovedNewsletters(now);

  return {
    draftsPrepared: drafts.prepared,
    aiDrafted: drafts.ai,
    newslettersSent: dispatch.newsletters,
    recipientsSent: dispatch.sent,
    recipientsFailed: dispatch.failed,
  };
}
