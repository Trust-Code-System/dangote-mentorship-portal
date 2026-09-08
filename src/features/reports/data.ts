import 'server-only';
import { ReportKind, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { hasAnyRole, type SessionUser } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getMenteePairing, getMentorPairings } from '@/lib/pairings';
import { parseReportContent, type ReportContent } from './schema';

// Reads for the Reports feature (CLAUDE.md §13). Authorization is centralized
// in `canReadReport` / `assertCanCreate` so the list page, the detail page and
// the export route cannot drift apart — the export route in particular is
// outside the edge auth matcher and must enforce this itself.

export interface ReportSummary {
  id: string;
  kind: ReportKind;
  title: string;
  subjectName: string | null;
  authorName: string | null;
  aiPolished: boolean;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportDetail extends ReportSummary {
  cohortId: string;
  authorId: string;
  subjectUserId: string | null;
  content: ReportContent | null;
}

function nameOf(user: { name: string | null; email: string } | null): string | null {
  if (!user) return null;
  return user.name ?? user.email;
}

/** Which report kinds this user may create, given their roles. */
export function creatableKinds(user: SessionUser): ReportKind[] {
  const kinds: ReportKind[] = [];
  if (user.roles.includes(RoleName.MENTEE)) kinds.push(ReportKind.MENTEE_PROGRESS);
  if (user.roles.includes(RoleName.MENTOR)) kinds.push(ReportKind.MENTOR_PAIR);
  if (hasAnyRole(user, ADMIN_ROLES)) {
    kinds.push(ReportKind.PROGRAMME);
    kinds.push(ReportKind.ENGAGEMENT);
  }
  return kinds;
}

/**
 * Reports visible to a user: their own, plus (for admins) every report in the
 * cohorts they administer. A mentor does not see a mentee's own self-report and
 * a mentee does not see their mentor's write-up — those are separate documents
 * with separate authors.
 */
export async function listReports(user: SessionUser): Promise<ReportSummary[]> {
  const isAdmin = hasAnyRole(user, ADMIN_ROLES);

  const reports = await prisma.report.findMany({
    where: isAdmin
      ? {
          deletedAt: null,
          ...(user.adminCohortScope === 'ALL'
            ? {}
            : { cohortId: { in: user.adminCohortScope } }),
        }
      : { deletedAt: null, authorId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      kind: true,
      title: true,
      aiPolished: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true, email: true } },
      subject: { select: { name: true, email: true } },
    },
  });

  return reports.map((report) => ({
    id: report.id,
    kind: report.kind,
    title: report.title,
    subjectName: nameOf(report.subject),
    authorName: nameOf(report.author),
    aiPolished: report.aiPolished,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  }));
}

/**
 * A report the user is allowed to read, or null. The author always may; an
 * admin may within their cohort scope. Nobody else — a report can quote goal
 * text and mentor commentary.
 */
export async function getReadableReport(
  user: SessionUser,
  reportId: string,
): Promise<ReportDetail | null> {
  const report = await prisma.report.findFirst({
    where: { id: reportId, deletedAt: null },
    select: {
      id: true,
      cohortId: true,
      kind: true,
      title: true,
      authorId: true,
      subjectUserId: true,
      content: true,
      aiPolished: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true, email: true } },
      subject: { select: { name: true, email: true } },
    },
  });
  if (!report) return null;

  const isAuthor = report.authorId === user.id;
  const isAdmin =
    hasAnyRole(user, ADMIN_ROLES) &&
    (user.adminCohortScope === 'ALL' || user.adminCohortScope.includes(report.cohortId));
  if (!isAuthor && !isAdmin) return null;

  return {
    id: report.id,
    cohortId: report.cohortId,
    kind: report.kind,
    title: report.title,
    authorId: report.authorId,
    subjectUserId: report.subjectUserId,
    content: parseReportContent(report.content),
    subjectName: nameOf(report.subject),
    authorName: nameOf(report.author),
    aiPolished: report.aiPolished,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

/** Mentees a mentor may report on (their accepted pairings). */
export async function reportableMentees(
  user: SessionUser,
): Promise<{ id: string; name: string }[]> {
  if (!user.roles.includes(RoleName.MENTOR)) return [];
  const pairings = await getMentorPairings(user.id);
  return pairings.map((pairing) => ({
    id: pairing.menteeId,
    name: pairing.menteeName ?? pairing.menteeId,
  }));
}

export interface ReportTarget {
  cohortId: string;
  subjectUserId: string | null;
}

/**
 * Resolve and authorize what a requested report would cover. Throwing here
 * rather than returning null keeps the action's happy path linear; the action
 * maps the error into a typed failure.
 */
export async function resolveReportTarget(
  user: SessionUser,
  kind: ReportKind,
  subjectUserId: string | null,
  activeCohortId: string | null,
): Promise<ReportTarget | { error: string }> {
  if (!creatableKinds(user).includes(kind)) {
    return { error: 'You cannot create this kind of report.' };
  }

  if (kind === ReportKind.MENTEE_PROGRESS) {
    const pairing = await getMenteePairing(user.id);
    if (pairing) return { cohortId: pairing.cohortId, subjectUserId: user.id };

    // Not yet matched: fall back to their cohort grant so they can still
    // report on their own goals and assessments.
    const grant = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        cohortId: { not: null },
        role: { name: RoleName.MENTEE },
      },
      select: { cohortId: true },
    });
    if (!grant?.cohortId) return { error: 'You are not enrolled in a cohort.' };
    return { cohortId: grant.cohortId, subjectUserId: user.id };
  }

  if (kind === ReportKind.MENTOR_PAIR) {
    if (!subjectUserId) return { error: 'Choose which mentee this report is about.' };
    // Authorize against the accepted pairing — never trust the posted id.
    const pairings = await getMentorPairings(user.id);
    const pairing = pairings.find((p) => p.menteeId === subjectUserId);
    if (!pairing) return { error: 'You are not paired with that mentee.' };
    return { cohortId: pairing.cohortId, subjectUserId };
  }

  // PROGRAMME / ENGAGEMENT (admin): the active cohort, inside the admin's scope.
  if (!activeCohortId) return { error: 'No active cohort to report on.' };
  if (
    user.adminCohortScope !== 'ALL' &&
    !user.adminCohortScope.includes(activeCohortId)
  ) {
    return { error: 'This cohort is outside your scope.' };
  }
  return { cohortId: activeCohortId, subjectUserId: null };
}
