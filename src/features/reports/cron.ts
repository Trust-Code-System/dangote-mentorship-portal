import 'server-only';
import { CohortStatus, Prisma, ReportKind, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { writeAuditLog } from '@/lib/audit/audit';
import { notifyMany } from '@/lib/notifications/notify';
import { reportError } from '@/lib/observability/report';
import { buildReport, scopeFor } from './build';
import { isWeeklyReportDue, isoWeekKey, startOfIsoWeek } from './weekly';

// Weekly engagement report generation.
//
// Runs from the daily scheduler and produces exactly one report per active
// cohort per ISO week (see ./weekly.ts for why that framing rather than "every
// Monday"). The report is saved as a normal Report row, so it lands in
// /admin/reports and exports to Word and Excel through the machinery that
// already exists — no separate delivery path to maintain.
//
// Unlike the newsletter cron, there is no human gate here: this report is an
// internal admin artefact, not something sent to participants. It is generated
// and the admins are notified; nothing leaves the portal.

export interface WeeklyReportCronResult {
  cohortsChecked: number;
  reportsGenerated: number;
  adminsNotified: number;
}

/** The ISO week of the most recent engagement report for a cohort, or null. */
async function lastGeneratedWeek(cohortId: string): Promise<string | null> {
  const latest = await prisma.report.findFirst({
    where: { cohortId, kind: ReportKind.ENGAGEMENT, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return latest ? isoWeekKey(latest.createdAt) : null;
}

export async function runWeeklyReportCron(
  now = new Date(),
): Promise<WeeklyReportCronResult> {
  const cohorts = await prisma.cohort.findMany({
    where: { deletedAt: null, status: CohortStatus.ACTIVE },
    select: { id: true, name: true },
  });

  const result: WeeklyReportCronResult = {
    cohortsChecked: cohorts.length,
    reportsGenerated: 0,
    adminsNotified: 0,
  };
  if (cohorts.length === 0) return result;

  // The report needs an author. Attribute it to the longest-standing active
  // Super Admin — the person who will read it.
  const admins = await prisma.userRole.findMany({
    where: {
      deletedAt: null,
      role: { name: RoleName.SUPER_ADMIN },
      user: { isActive: true, deletedAt: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  const adminIds = Array.from(new Set(admins.map((a) => a.userId)));
  const authorId = adminIds[0];
  if (!authorId) return result;

  for (const cohort of cohorts) {
    try {
      const lastWeek = await lastGeneratedWeek(cohort.id);
      if (!isWeeklyReportDue({ now, lastGeneratedWeek: lastWeek })) continue;

      // The report covers the ISO week to date.
      const from = startOfIsoWeek(now);
      const built = await buildReport(
        ReportKind.ENGAGEMENT,
        { cohortId: cohort.id, from, to: now },
        { authorId },
      );

      const report = await prisma.report.create({
        data: {
          cohortId: cohort.id,
          authorId,
          kind: ReportKind.ENGAGEMENT,
          title: `${built.title} — ${isoWeekKey(now)}`,
          subjectUserId: null,
          periodStart: from,
          periodEnd: now,
          content: built.content as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      await writeAuditLog({
        cohortId: cohort.id,
        action: 'report.weekly_generated',
        entityType: 'Report',
        entityId: report.id,
        metadata: { week: isoWeekKey(now), trigger: 'schedule' },
      });

      // A report nobody knows about is the same as no report.
      await notifyMany(adminIds, {
        type: 'engagement_report_ready',
        params: { cohort: cohort.name, week: isoWeekKey(now) },
        link: `/admin/reports/${report.id}`,
        cohortId: cohort.id,
      });

      result.reportsGenerated += 1;
      result.adminsNotified += adminIds.length;
    } catch (error) {
      // One cohort failing must not stop the others; the run is idempotent so
      // the next day's tick retries this week.
      reportError(error, { job: 'cron/weekly-reports', cohortId: cohort.id });
    }
  }

  return result;
}

/** `scopeFor` is re-exported for the on-demand admin path's convenience. */
export { scopeFor };
