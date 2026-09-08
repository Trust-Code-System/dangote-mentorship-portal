'use server';

import { revalidatePath } from 'next/cache';
import { CohortStatus, Prisma, ReportKind } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { getAiAdapter } from '@/lib/ai';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { fail, mapActionError, ok, type ActionResult } from '@/lib/actions/result';
import { buildReport, scopeFor } from './build';
import {
  buildPolishPrompt,
  extractNarrative,
  mergePolishedNarrative,
  parsePolishResponse,
} from './assistant';
import { getReadableReport, resolveReportTarget } from './data';
import {
  createReportSchema,
  parseReportContent,
  reportIdSchema,
  updateReportContentSchema,
  type ReportContent,
} from './schema';

// Report mutations (CLAUDE.md §13). The pipeline is the standard §3 one, with
// one addition specific to this feature: the AI polish pass NEVER writes. It
// returns a proposed document to the author, who accepts it with a second,
// explicit action (§0 rule 5).

// Reports are listed at two routes (participant /reports, admin /admin/reports);
// revalidate both so a mutation is visible wherever the author is working.
function revalidateReportPaths(reportId?: string): void {
  revalidatePath('/reports');
  revalidatePath('/admin/reports');
  if (reportId) {
    revalidatePath(`/reports/${reportId}`);
    revalidatePath(`/admin/reports/${reportId}`);
  }
}

export async function createReport(
  formData: FormData,
): Promise<ActionResult<{ reportId: string }>> {
  try {
    const user = await requireUser();
    const input = createReportSchema.parse({
      kind: formData.get('kind'),
      subjectUserId: formData.get('subjectUserId'),
      periodMonths: formData.get('periodMonths') || undefined,
    });

    // The active cohort is only needed for a programme-wide report.
    const activeCohort =
      input.kind === ReportKind.PROGRAMME
        ? await prisma.cohort.findFirst({
            where: { deletedAt: null, status: CohortStatus.ACTIVE },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          })
        : null;

    const target = await resolveReportTarget(
      user,
      input.kind,
      input.subjectUserId,
      activeCohort?.id ?? null,
    );
    if ('error' in target) return fail({ code: 'FORBIDDEN', message: target.error });

    const scope = scopeFor(target.cohortId, input.periodMonths);
    const built = await buildReport(input.kind, scope, {
      subjectUserId: target.subjectUserId,
      authorId: user.id,
    });

    const report = await prisma.report.create({
      data: {
        cohortId: target.cohortId,
        authorId: user.id,
        kind: input.kind,
        title: built.title,
        subjectUserId: built.subjectUserId,
        periodStart: scope.from,
        periodEnd: scope.to,
        content: built.content as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: target.cohortId,
      action: 'report.created',
      entityType: 'Report',
      entityId: report.id,
      metadata: {
        kind: input.kind,
        subjectUserId: built.subjectUserId,
        periodMonths: input.periodMonths ?? null,
        blockCount: built.content.blocks.length,
      },
    });

    revalidateReportPaths(report.id);
    return ok({ reportId: report.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/**
 * Ask the AI to correct and format the report's narrative. Returns the proposed
 * content WITHOUT saving it — the author reviews the suggestion and calls
 * applyReportPolish to commit.
 */
export async function requestReportPolish(
  formData: FormData,
): Promise<ActionResult<{ content: ReportContent; changed: boolean }>> {
  try {
    const user = await requireUser();
    const { reportId } = reportIdSchema.parse({ reportId: formData.get('reportId') });

    // AI endpoints are rate-limited (CLAUDE.md §14).
    if (!(await checkRateLimit(`ai:report-polish:${user.id}`, 10, 60_000)).ok) {
      return fail({ code: 'CONFLICT', message: 'Too many AI requests. Please wait a moment.' });
    }

    const report = await getReadableReport(user, reportId);
    if (!report) return fail({ code: 'NOT_FOUND', message: 'Report not found.' });
    if (report.authorId !== user.id) {
      return fail({ code: 'FORBIDDEN', message: 'Only the author can reformat this report.' });
    }
    if (!report.content) {
      return fail({ code: 'CONFLICT', message: 'This report has no readable content.' });
    }

    const ai = getAiAdapter();
    if (!ai.enabled) {
      return fail({ code: 'CONFLICT', message: 'AI formatting is not configured.' });
    }

    const narrative = extractNarrative(report.content);
    if (narrative.length === 0) {
      return ok({ content: report.content, changed: false });
    }

    const lang = user.locale === 'FR' ? 'FR' : 'EN';
    const { system, prompt } = buildPolishPrompt(report.content, narrative, lang);
    const raw = await ai.complete({ system, prompt, temperature: 0.2, maxTokens: 4000 });

    const merged = mergePolishedNarrative(
      report.content,
      narrative,
      parsePolishResponse(raw),
    );
    const changed = JSON.stringify(merged) !== JSON.stringify(report.content);

    await writeAuditLog({
      actorId: user.id,
      cohortId: report.cohortId,
      action: 'report.polish_suggested',
      entityType: 'Report',
      entityId: report.id,
      // Metadata only — the report body is not logged (§14).
      metadata: { model: ai.id, narrativeBlocks: narrative.length, changed },
    });

    return ok({ content: merged, changed });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Commit an edited/polished report body. This is the human approval step. */
export async function saveReportContent(
  formData: FormData,
): Promise<ActionResult<{ reportId: string }>> {
  try {
    const user = await requireUser();
    const input = updateReportContentSchema.parse({
      reportId: formData.get('reportId'),
      title: formData.get('title'),
      content: formData.get('content'),
    });

    const report = await getReadableReport(user, input.reportId);
    if (!report) return fail({ code: 'NOT_FOUND', message: 'Report not found.' });
    if (report.authorId !== user.id) {
      return fail({ code: 'FORBIDDEN', message: 'Only the author can edit this report.' });
    }

    // `aiPolished` records that the AI pass was accepted, which is only true
    // when the saved body differs from what the builder produced.
    const wasAiSuggested = formData.get('aiPolished') === 'true';

    await prisma.report.update({
      where: { id: report.id },
      data: {
        title: input.title,
        content: input.content as unknown as Prisma.InputJsonValue,
        ...(wasAiSuggested ? { aiPolished: true, aiPolishedAt: new Date() } : {}),
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: report.cohortId,
      action: wasAiSuggested ? 'report.polish_accepted' : 'report.edited',
      entityType: 'Report',
      entityId: report.id,
      metadata: { blockCount: input.content.blocks.length },
    });

    revalidateReportPaths(report.id);
    return ok({ reportId: report.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Soft-delete: reports are user-generated content and are never hard-deleted. */
export async function archiveReport(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { reportId } = reportIdSchema.parse({ reportId: formData.get('reportId') });

    const report = await getReadableReport(user, reportId);
    if (!report) return fail({ code: 'NOT_FOUND', message: 'Report not found.' });
    if (report.authorId !== user.id) {
      return fail({ code: 'FORBIDDEN', message: 'Only the author can archive this report.' });
    }

    await prisma.report.update({
      where: { id: report.id },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: report.cohortId,
      action: 'report.archived',
      entityType: 'Report',
      entityId: report.id,
    });

    revalidateReportPaths(report.id);
    return ok({ id: report.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Re-run the builder so a saved report reflects current data. */
export async function refreshReport(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { reportId } = reportIdSchema.parse({ reportId: formData.get('reportId') });

    const report = await getReadableReport(user, reportId);
    if (!report) return fail({ code: 'NOT_FOUND', message: 'Report not found.' });
    if (report.authorId !== user.id) {
      return fail({ code: 'FORBIDDEN', message: 'Only the author can refresh this report.' });
    }

    const months =
      report.periodStart && report.periodEnd
        ? Math.max(
            1,
            Math.round(
              (report.periodEnd.getTime() - report.periodStart.getTime()) /
                (30 * 24 * 60 * 60 * 1000),
            ),
          )
        : undefined;

    const scope = scopeFor(report.cohortId, months);
    const built = await buildReport(report.kind, scope, {
      subjectUserId: report.subjectUserId,
      authorId: user.id,
    });

    await prisma.report.update({
      where: { id: report.id },
      data: {
        content: built.content as unknown as Prisma.InputJsonValue,
        periodStart: scope.from,
        periodEnd: scope.to,
        // Refreshing discards the accepted polish: the text is newly built.
        aiPolished: false,
        aiPolishedAt: null,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: report.cohortId,
      action: 'report.refreshed',
      entityType: 'Report',
      entityId: report.id,
      metadata: { blockCount: built.content.blocks.length },
    });

    revalidateReportPaths(report.id);
    return ok({ id: report.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Parse helper re-exported for the detail page's client editor. */
export async function readReportContent(
  reportId: string,
): Promise<ActionResult<{ content: ReportContent | null }>> {
  try {
    const user = await requireUser();
    const report = await getReadableReport(user, reportId);
    if (!report) return fail({ code: 'NOT_FOUND', message: 'Report not found.' });
    return ok({ content: parseReportContent(report.content) });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── useActionState wrappers ─────────────────────────────────────────────────

export type CreateReportState = ActionResult<{ reportId: string }> | null;
export type PolishState = ActionResult<{ content: ReportContent; changed: boolean }> | null;
export type SaveReportState = ActionResult<{ reportId: string }> | null;
export type ReportActionState = ActionResult<{ id: string }> | null;

export async function createReportForm(
  _prev: CreateReportState,
  formData: FormData,
): Promise<CreateReportState> {
  return createReport(formData);
}

export async function requestReportPolishForm(
  _prev: PolishState,
  formData: FormData,
): Promise<PolishState> {
  return requestReportPolish(formData);
}

export async function saveReportContentForm(
  _prev: SaveReportState,
  formData: FormData,
): Promise<SaveReportState> {
  return saveReportContent(formData);
}

export async function archiveReportForm(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  return archiveReport(formData);
}

export async function refreshReportForm(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  return refreshReport(formData);
}
