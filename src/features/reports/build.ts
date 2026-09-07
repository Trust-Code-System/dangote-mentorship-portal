import 'server-only';
import { subMonths } from 'date-fns';
import {
  ActionItemStatus,
  GoalStatus,
  MatchStatus,
  ReportKind,
  ReviewStatus,
  RoleName,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { ReportBlock, ReportContent } from './schema';

// Report builders (CLAUDE.md §13). Each builder assembles a report from real
// portal data into the structured block model, which the Word and Excel
// exporters then render. No AI here: the numbers and the record are factual, and
// the AI polish pass is a separate, human-approved step (§0 rule 5).

export interface BuildScope {
  cohortId: string;
  /** Reporting window. Null start = the whole programme to date. */
  from: Date | null;
  to: Date;
}

export function scopeFor(cohortId: string, periodMonths?: number): BuildScope {
  const to = new Date();
  return { cohortId, from: periodMonths ? subMonths(to, periodMonths) : null, to };
}

function dateFilter(scope: BuildScope) {
  return scope.from ? { gte: scope.from, lte: scope.to } : { lte: scope.to };
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : '—';
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Percentage as a display string, guarding the zero-denominator case. */
function percent(part: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

export interface BuiltReport {
  title: string;
  content: ReportContent;
  subjectUserId: string | null;
}

// ── Mentee progress report ──────────────────────────────────────────────────

/**
 * One mentee's development record: goals and their status, sessions held,
 * outstanding actions, and assessment compliance. Used both for the mentee's
 * own report and (with the same body) for a mentor reporting on that mentee.
 */
async function buildMenteeReport(
  menteeId: string,
  scope: BuildScope,
  authoredByMentor: boolean,
): Promise<BuiltReport> {
  const [mentee, match, goals, sessions, actions, assessments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: menteeId },
      select: {
        name: true,
        email: true,
        menteeProfile: {
          select: { department: true, jobTitle: true, location: true, careerGoals: true },
        },
      },
    }),
    prisma.match.findFirst({
      where: {
        menteeId,
        cohortId: scope.cohortId,
        status: MatchStatus.ACCEPTED,
        deletedAt: null,
      },
      select: { acceptedAt: true, mentor: { select: { name: true, email: true } } },
    }),
    prisma.goal.findMany({
      where: { menteeId, cohortId: scope.cohortId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        title: true,
        competency: true,
        status: true,
        stage: true,
        startDate: true,
        endDate: true,
        successMeasure: true,
        mentorComments: true,
      },
    }),
    prisma.sessionLog.findMany({
      where: {
        menteeId,
        cohortId: scope.cohortId,
        deletedAt: null,
        date: dateFilter(scope),
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        meetingType: true,
        competencyDiscussed: true,
        discussionSummary: true,
        actionsAgreed: true,
        challenges: true,
      },
    }),
    prisma.actionItem.findMany({
      where: {
        cohortId: scope.cohortId,
        assigneeId: menteeId,
        deletedAt: null,
        status: { not: ActionItemStatus.DONE },
      },
      orderBy: { dueDate: 'asc' },
      select: { title: true, dueDate: true, status: true },
    }),
    prisma.assessmentWindow.findMany({
      where: { cohortId: scope.cohortId, isActive: true, deletedAt: null },
      orderBy: { sequence: 'asc' },
      select: {
        label: true,
        dueAt: true,
        responses: {
          where: { respondentId: menteeId, status: ReviewStatus.SUBMITTED, deletedAt: null },
          select: { submittedAt: true },
          take: 1,
        },
      },
    }),
  ]);

  const name = mentee?.name ?? mentee?.email ?? 'Mentee';
  const approved = goals.filter((g) => g.status === GoalStatus.APPROVED).length;
  const achieved = goals.filter((g) => g.stage === 'ACHIEVED').length;
  const openedWindows = assessments.filter((w) => w.dueAt.getTime() <= scope.to.getTime());
  const assessmentsDone = openedWindows.filter((w) => w.responses.length > 0).length;

  const blocks: ReportBlock[] = [
    {
      kind: 'kpis',
      items: [
        { label: 'Goals set', value: String(goals.length) },
        { label: 'Goals approved', value: String(approved) },
        { label: 'Goals achieved', value: String(achieved) },
        { label: 'Sessions logged', value: String(sessions.length) },
        {
          label: 'Assessments completed',
          value: `${assessmentsDone}/${openedWindows.length}`,
          hint: percent(assessmentsDone, openedWindows.length),
        },
        { label: 'Open actions', value: String(actions.length) },
      ],
    },
    { kind: 'heading', level: 2, text: 'Participant' },
    {
      kind: 'bullets',
      items: [
        `**Mentee:** ${name}${mentee?.menteeProfile?.jobTitle ? ` — ${mentee.menteeProfile.jobTitle}` : ''}`,
        `**Department:** ${mentee?.menteeProfile?.department ?? '—'}`,
        `**Location:** ${mentee?.menteeProfile?.location ?? '—'}`,
        `**Mentor:** ${match?.mentor.name ?? match?.mentor.email ?? 'Not yet matched'}`,
        `**Paired since:** ${formatDate(match?.acceptedAt)}`,
      ],
    },
  ];

  if (mentee?.menteeProfile?.careerGoals) {
    blocks.push(
      { kind: 'heading', level: 2, text: 'Career direction' },
      { kind: 'paragraph', text: mentee.menteeProfile.careerGoals },
    );
  }

  blocks.push({ kind: 'heading', level: 2, text: 'Development goals' });
  if (goals.length === 0) {
    blocks.push({ kind: 'paragraph', text: 'No goals have been set in this period.' });
  } else {
    blocks.push({
      kind: 'table',
      caption: 'Goals',
      columns: ['Goal', 'Competency', 'Status', 'Stage', 'Target date', 'Success measure'],
      rows: goals.map((goal) => [
        goal.title,
        goal.competency ?? '—',
        titleCase(goal.status),
        titleCase(goal.stage),
        formatDate(goal.endDate),
        goal.successMeasure ?? '—',
      ]),
    });
  }

  blocks.push({ kind: 'heading', level: 2, text: 'Mentoring sessions' });
  if (sessions.length === 0) {
    blocks.push({ kind: 'paragraph', text: 'No sessions were logged in this period.' });
  } else {
    blocks.push({
      kind: 'table',
      caption: 'Sessions',
      columns: ['Date', 'Type', 'Competency', 'Discussion', 'Actions agreed', 'Challenges'],
      rows: sessions.map((session) => [
        formatDate(session.date),
        session.meetingType ? titleCase(session.meetingType) : '—',
        session.competencyDiscussed ?? '—',
        session.discussionSummary ?? '—',
        session.actionsAgreed ?? '—',
        session.challenges ?? '—',
      ]),
    });
  }

  if (actions.length > 0) {
    blocks.push(
      { kind: 'heading', level: 2, text: 'Outstanding actions' },
      {
        kind: 'table',
        caption: 'Open actions',
        columns: ['Action', 'Due', 'Status'],
        rows: actions.map((action) => [
          action.title,
          formatDate(action.dueDate),
          titleCase(action.status),
        ]),
      },
    );
  }

  if (openedWindows.length > 0) {
    blocks.push(
      { kind: 'heading', level: 2, text: 'Quarterly assessments' },
      {
        kind: 'table',
        caption: 'Assessment compliance',
        columns: ['Assessment', 'Due', 'Submitted'],
        rows: openedWindows.map((w) => [
          w.label,
          formatDate(w.dueAt),
          formatDate(w.responses[0]?.submittedAt ?? null),
        ]),
      },
    );
  }

  // Mentor comments are the mentor's assessment of the mentee, so they belong
  // in a mentor-authored report, not in the mentee's own copy.
  const mentorComments = goals.filter((g) => g.mentorComments);
  if (authoredByMentor && mentorComments.length > 0) {
    blocks.push(
      { kind: 'heading', level: 2, text: 'Mentor commentary' },
      {
        kind: 'bullets',
        items: mentorComments.map((g) => `**${g.title}:** ${g.mentorComments}`),
      },
    );
  }

  return {
    title: authoredByMentor ? `Mentoring report — ${name}` : `My progress report — ${name}`,
    subjectUserId: menteeId,
    content: {
      subtitle: scope.from
        ? `Period ${formatDate(scope.from)} to ${formatDate(scope.to)}`
        : `Programme to date, as at ${formatDate(scope.to)}`,
      blocks,
    },
  };
}

// ── Programme report (admin) ────────────────────────────────────────────────

async function buildProgrammeReport(scope: BuildScope): Promise<BuiltReport> {
  const [cohort, mentorCount, menteeCount, matches, goals, sessions, windows, departments] =
    await Promise.all([
      prisma.cohort.findUnique({
        where: { id: scope.cohortId },
        select: { name: true, startDate: true, endDate: true },
      }),
      prisma.userRole.count({
        where: {
          cohortId: scope.cohortId,
          deletedAt: null,
          role: { name: RoleName.MENTOR },
          user: { isActive: true, deletedAt: null },
        },
      }),
      prisma.userRole.count({
        where: {
          cohortId: scope.cohortId,
          deletedAt: null,
          role: { name: RoleName.MENTEE },
          user: { isActive: true, deletedAt: null },
        },
      }),
      prisma.match.groupBy({
        by: ['status'],
        where: { cohortId: scope.cohortId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.goal.groupBy({
        by: ['status'],
        where: { cohortId: scope.cohortId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.sessionLog.count({
        where: { cohortId: scope.cohortId, deletedAt: null, date: dateFilter(scope) },
      }),
      prisma.assessmentWindow.findMany({
        where: { cohortId: scope.cohortId, isActive: true, deletedAt: null },
        orderBy: { sequence: 'asc' },
        select: { id: true, label: true, dueAt: true },
      }),
      prisma.menteeProfile.groupBy({
        by: ['department'],
        where: { cohortId: scope.cohortId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

  const matchesBy = new Map(matches.map((m) => [m.status, m._count._all]));
  const goalsBy = new Map(goals.map((g) => [g.status, g._count._all]));
  const accepted = matchesBy.get(MatchStatus.ACCEPTED) ?? 0;
  const goalTotal = goals.reduce((sum, g) => sum + g._count._all, 0);
  const goalsApproved = goalsBy.get(GoalStatus.APPROVED) ?? 0;

  // Assessment compliance per window, counted in one grouped query.
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

  const blocks: ReportBlock[] = [
    {
      kind: 'kpis',
      items: [
        { label: 'Mentors', value: String(mentorCount) },
        { label: 'Mentees', value: String(menteeCount) },
        {
          label: 'Matched pairs',
          value: String(accepted),
          hint: percent(accepted, menteeCount),
        },
        { label: 'Goals set', value: String(goalTotal) },
        {
          label: 'Goals approved',
          value: String(goalsApproved),
          hint: percent(goalsApproved, goalTotal),
        },
        { label: 'Sessions logged', value: String(sessions) },
      ],
    },
    { kind: 'heading', level: 2, text: 'Matching' },
    {
      kind: 'table',
      caption: 'Match status',
      columns: ['Status', 'Pairs'],
      rows: matches.map((m) => [titleCase(m.status), String(m._count._all)]),
    },
    { kind: 'heading', level: 2, text: 'Goals' },
    {
      kind: 'table',
      caption: 'Goal status',
      columns: ['Status', 'Goals'],
      rows: goals.map((g) => [titleCase(g.status), String(g._count._all)]),
    },
  ];

  if (windows.length > 0) {
    blocks.push(
      { kind: 'heading', level: 2, text: 'Quarterly assessment compliance' },
      {
        kind: 'table',
        caption: 'Assessment compliance',
        columns: ['Assessment', 'Due', 'Submitted', 'Rate'],
        rows: windows.map((w) => {
          const count = submittedBy.get(w.id) ?? 0;
          return [w.label, formatDate(w.dueAt), String(count), percent(count, menteeCount)];
        }),
      },
    );
  }

  if (departments.length > 0) {
    blocks.push(
      { kind: 'heading', level: 2, text: 'Participation by department' },
      {
        kind: 'table',
        caption: 'Departments',
        columns: ['Department', 'Mentees'],
        rows: departments
          .slice()
          .sort((a, b) => b._count._all - a._count._all)
          .map((d) => [d.department ?? 'Not stated', String(d._count._all)]),
      },
    );
  }

  return {
    title: `Programme report — ${cohort?.name ?? 'Cohort'}`,
    subjectUserId: null,
    content: {
      subtitle: scope.from
        ? `Period ${formatDate(scope.from)} to ${formatDate(scope.to)}`
        : `Programme to date, as at ${formatDate(scope.to)}`,
      blocks,
    },
  };
}

/** Dispatch to the right builder for a report kind. */
export async function buildReport(
  kind: ReportKind,
  scope: BuildScope,
  options: { subjectUserId?: string | null; authorId: string },
): Promise<BuiltReport> {
  switch (kind) {
    case ReportKind.MENTEE_PROGRESS:
      return buildMenteeReport(options.subjectUserId ?? options.authorId, scope, false);
    case ReportKind.MENTOR_PAIR: {
      if (!options.subjectUserId) throw new Error('A mentor report needs a mentee.');
      return buildMenteeReport(options.subjectUserId, scope, true);
    }
    case ReportKind.PROGRAMME:
      return buildProgrammeReport(scope);
  }
}
