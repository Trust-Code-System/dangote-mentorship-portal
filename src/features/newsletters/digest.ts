import 'server-only';
import { subDays } from 'date-fns';
import {
  ActionItemStatus,
  ClinicStatus,
  GoalStatus,
  MeetingStatus,
  ReviewStatus,
  ReviewType,
  RoleName,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// Portal activity digest — the factual input for the Newsletter Assistant
// (CLAUDE.md §9.5: "drafts weekly newsletters from real portal data").
//
// Everything here is a count or a date, never a name or a message body: the
// digest is handed to an AI provider, so it must not carry personal content out
// of the portal (§14 — no PII in logs or prompts). Success stories and
// spotlights stay the admin's job to write.

export interface NewsletterDigest {
  cohortName: string;
  periodDays: number;
  goalsApproved: number;
  goalsSubmitted: number;
  sessionsLogged: number;
  meetingsScheduled: number;
  actionsCompleted: number;
  actionsOpen: number;
  activePairs: number;
  totalPairs: number;
  /** Gating assessment windows whose due date falls in the next 21 days. */
  upcomingAssessments: { label: string; dueAt: Date; submitted: number; total: number }[];
  /**
   * The monthly meeting form currently open, if any. Reminders are the ONLY
   * enforcement for this form and the newsletter is its main reminder channel,
   * so it is a first-class part of the digest rather than a footnote.
   */
  monthlyForm: { label: string; dueAt: Date; submitted: number; total: number } | null;
  upcomingClinics: { title: string; scheduledAt: Date | null }[];
}

export async function buildNewsletterDigest(
  cohortId: string,
  periodDays = 7,
): Promise<NewsletterDigest | null> {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, deletedAt: null },
    select: { name: true },
  });
  if (!cohort) return null;

  const now = new Date();
  const since = subDays(now, periodDays);
  const soon = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  const [
    goalsApproved,
    goalsSubmitted,
    sessionsLogged,
    meetingsScheduled,
    actionsCompleted,
    actionsOpen,
    totalPairs,
    activePairs,
    windows,
    clinics,
    menteeCount,
  ] = await Promise.all([
    prisma.goal.count({
      where: {
        cohortId,
        deletedAt: null,
        status: GoalStatus.APPROVED,
        approvedAt: { gte: since, lte: now },
      },
    }),
    prisma.goal.count({
      where: {
        cohortId,
        deletedAt: null,
        status: GoalStatus.SUBMITTED,
        updatedAt: { gte: since, lte: now },
      },
    }),
    prisma.sessionLog.count({
      where: { cohortId, deletedAt: null, date: { gte: since, lte: now } },
    }),
    prisma.meeting.count({
      where: {
        cohortId,
        deletedAt: null,
        status: MeetingStatus.SCHEDULED,
        startsAt: { gte: now, lte: soon },
      },
    }),
    prisma.actionItem.count({
      where: {
        cohortId,
        deletedAt: null,
        status: ActionItemStatus.DONE,
        updatedAt: { gte: since, lte: now },
      },
    }),
    prisma.actionItem.count({
      where: { cohortId, deletedAt: null, status: { not: ActionItemStatus.DONE } },
    }),
    prisma.match.count({ where: { cohortId, deletedAt: null, status: 'ACCEPTED' } }),
    // "Active" = logged a session in the window. The cheapest honest proxy for
    // engagement without touching message content (§10 confidentiality).
    prisma.sessionLog
      .findMany({
        where: { cohortId, deletedAt: null, date: { gte: since, lte: now } },
        select: { menteeId: true },
        distinct: ['menteeId'],
      })
      .then((rows) => rows.length),
    prisma.assessmentWindow.findMany({
      where: {
        cohortId,
        formType: ReviewType.QUARTERLY,
        isActive: true,
        deletedAt: null,
        dueAt: { gte: subDays(now, 1), lte: soon },
      },
      orderBy: { dueAt: 'asc' },
      select: { id: true, label: true, dueAt: true },
    }),
    prisma.clinic.findMany({
      where: {
        cohortId,
        deletedAt: null,
        status: ClinicStatus.SCHEDULED,
        scheduledAt: { gte: now, lte: soon },
      },
      orderBy: { scheduledAt: 'asc' },
      select: { title: true, scheduledAt: true },
      take: 5,
    }),
    prisma.userRole.count({
      where: {
        cohortId,
        deletedAt: null,
        role: { name: RoleName.MENTEE },
        user: { isActive: true, deletedAt: null },
      },
    }),
  ]);

  // The monthly window open right now (opened, not yet past due).
  const monthlyWindow = await prisma.assessmentWindow.findFirst({
    where: {
      cohortId,
      formType: ReviewType.MONTHLY,
      isActive: true,
      deletedAt: null,
      opensAt: { lte: now },
      dueAt: { gte: now },
    },
    orderBy: { dueAt: 'asc' },
    select: { id: true, label: true, dueAt: true },
  });

  const monthlySubmitted = monthlyWindow
    ? await prisma.formResponse.count({
        where: {
          assessmentWindowId: monthlyWindow.id,
          status: ReviewStatus.SUBMITTED,
          deletedAt: null,
        },
      })
    : 0;

  const submissions =
    windows.length > 0
      ? await prisma.formResponse.groupBy({
          by: ['assessmentWindowId'],
          where: {
            assessmentWindowId: { in: windows.map((w) => w.id) },
            status: ReviewStatus.SUBMITTED,
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];
  const submittedBy = new Map(submissions.map((s) => [s.assessmentWindowId, s._count._all]));

  return {
    cohortName: cohort.name,
    periodDays,
    goalsApproved,
    goalsSubmitted,
    sessionsLogged,
    meetingsScheduled,
    actionsCompleted,
    actionsOpen,
    activePairs,
    totalPairs,
    monthlyForm: monthlyWindow
      ? {
          label: monthlyWindow.label,
          dueAt: monthlyWindow.dueAt,
          submitted: monthlySubmitted,
          total: menteeCount,
        }
      : null,
    upcomingAssessments: windows.map((w) => ({
      label: w.label,
      dueAt: w.dueAt,
      submitted: submittedBy.get(w.id) ?? 0,
      total: menteeCount,
    })),
    upcomingClinics: clinics.map((clinic) => ({
      title: clinic.title,
      scheduledAt: clinic.scheduledAt,
    })),
  };
}
