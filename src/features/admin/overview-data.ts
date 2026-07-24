import 'server-only';
import {
  GoalStatus,
  Language,
  MeetingStatus,
  MeetingType,
  RoleName,
  TrainingStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// Read models for the lightweight admin "drill-down" list pages reached from the
// dashboard stat tiles (§12 admin dashboard). Programme-wide, read-only, and
// capped — they answer "show me the records behind this number." Heavier filtering
// and the full reviews/training-batch tooling land with M3.

const LIST_LIMIT = 200;

// ── Goals ───────────────────────────────────────────────────────────────────

export interface AdminGoalRow {
  id: string;
  title: string;
  competency: string | null;
  status: GoalStatus;
  menteeName: string | null;
  menteeProfileId: string | null;
  cohortName: string;
  createdAt: Date;
}

// Every goal that has left DRAFT (i.e. been submitted at least once), newest first.
export async function getProgrammeGoals(): Promise<AdminGoalRow[]> {
  const goals = await prisma.goal.findMany({
    where: { deletedAt: null, status: { not: GoalStatus.DRAFT } },
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
    select: {
      id: true,
      title: true,
      competency: true,
      status: true,
      createdAt: true,
      mentee: { select: { name: true, menteeProfile: { select: { id: true } } } },
      cohort: { select: { name: true } },
    },
  });

  return goals.map((g) => ({
    id: g.id,
    title: g.title,
    competency: g.competency,
    status: g.status,
    menteeName: g.mentee.name,
    menteeProfileId: g.mentee.menteeProfile?.id ?? null,
    cohortName: g.cohort.name,
    createdAt: g.createdAt,
  }));
}

// ── Meetings ──────────────────────────────────────────────────────────────────

export interface AdminMeetingRow {
  id: string;
  title: string;
  type: MeetingType;
  startsAt: Date | null;
  mentorName: string | null;
  mentorProfileId: string | null;
  menteeName: string | null;
  menteeProfileId: string | null;
  cohortName: string;
}

// Scheduled meetings still in the future that haven't been marked happened/no-show.
export async function getUpcomingMeetings(): Promise<AdminMeetingRow[]> {
  const now = new Date();
  const meetings = await prisma.meeting.findMany({
    where: {
      deletedAt: null,
      status: MeetingStatus.SCHEDULED,
      didHappen: null,
      startsAt: { gte: now },
    },
    orderBy: { startsAt: 'asc' },
    take: LIST_LIMIT,
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      mentor: { select: { name: true, mentorProfile: { select: { id: true } } } },
      mentee: { select: { name: true, menteeProfile: { select: { id: true } } } },
      cohort: { select: { name: true } },
    },
  });

  return meetings.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type,
    startsAt: m.startsAt,
    mentorName: m.mentor.name,
    mentorProfileId: m.mentor.mentorProfile?.id ?? null,
    menteeName: m.mentee.name,
    menteeProfileId: m.mentee.menteeProfile?.id ?? null,
    cohortName: m.cohort.name,
  }));
}

// ── Training ──────────────────────────────────────────────────────────────────

export interface AdminTrainingRow {
  id: string;
  name: string;
  role: RoleName;
  language: Language;
  department: string | null;
  status: TrainingStatus;
  cohortName: string;
}

export interface AdminTrainingOverview {
  mentorsTrained: number;
  mentorsTotal: number;
  menteesTrained: number;
  menteesTotal: number;
  rows: AdminTrainingRow[];
}

// Training completion across both profile tables, with the completed ones first so
// the "training completed" number the admin clicked is at the top.
export async function getTrainingOverview(): Promise<AdminTrainingOverview> {
  const [mentors, mentees] = await Promise.all([
    prisma.mentorProfile.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        preferredLanguage: true,
        department: true,
        trainingStatus: true,
        cohort: { select: { name: true } },
      },
    }),
    prisma.menteeProfile.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        preferredLanguage: true,
        department: true,
        trainingStatus: true,
        cohort: { select: { name: true } },
      },
    }),
  ]);

  const rows: AdminTrainingRow[] = [
    ...mentors.map((m) => ({
      id: m.id,
      name: m.fullName,
      role: RoleName.MENTOR,
      language: m.preferredLanguage,
      department: m.department,
      status: m.trainingStatus,
      cohortName: m.cohort.name,
    })),
    ...mentees.map((m) => ({
      id: m.id,
      name: m.fullName,
      role: RoleName.MENTEE,
      language: m.preferredLanguage,
      department: m.department,
      status: m.trainingStatus,
      cohortName: m.cohort.name,
    })),
  ].sort((a, b) => {
    // Completed first, then by name.
    const ac = a.status === TrainingStatus.COMPLETED ? 0 : 1;
    const bc = b.status === TrainingStatus.COMPLETED ? 0 : 1;
    return ac - bc || a.name.localeCompare(b.name);
  });

  const isDone = (s: TrainingStatus) => s === TrainingStatus.COMPLETED;
  return {
    mentorsTrained: mentors.filter((m) => isDone(m.trainingStatus)).length,
    mentorsTotal: mentors.length,
    menteesTrained: mentees.filter((m) => isDone(m.trainingStatus)).length,
    menteesTotal: mentees.length,
    rows,
  };
}

// ── Session logs (mentor reports) ─────────────────────────────────────────────

export interface AdminSessionLogRow {
  id: string;
  date: Date | null;
  time: string | null;
  meetingType: MeetingType | null;
  competencyDiscussed: string | null;
  goalDiscussed: string | null;
  // The substance a mentor reports after a session. `mentorNotes` is deliberately
  // omitted: the session log UI treats it as the mentor's private scratchpad
  // ("visible to the mentor only"), so admins see the shared record, not that.
  summary: string | null;
  actionsAgreed: string | null;
  challenges: string | null;
  resourcesNeeded: string | null;
  nextActionPlan: string | null;
  timeline: string | null;
  nextMeetingDate: Date | null;
  menteeReflection: string | null;
  mentorName: string | null;
  mentorProfileId: string | null;
  menteeName: string | null;
  menteeProfileId: string | null;
  cohortName: string;
}

/**
 * Every session log a mentor has filed across the programme, newest first — the
 * admin's read-only window onto the reports mentors submit (RBAC §4: admins may
 * *view* session logs). Read-only and capped; excludes soft-deleted rows and the
 * mentor's private notes. Mentors keep their own read-back on the sessions page.
 */
export async function getProgrammeSessionLogs(): Promise<AdminSessionLogRow[]> {
  const logs = await prisma.sessionLog.findMany({
    where: { deletedAt: null },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: LIST_LIMIT,
    select: {
      id: true,
      date: true,
      time: true,
      meetingType: true,
      competencyDiscussed: true,
      goalDiscussed: true,
      discussionSummary: true,
      aiSummary: true,
      actionsAgreed: true,
      challenges: true,
      resourcesNeeded: true,
      nextActionPlan: true,
      timeline: true,
      nextMeetingDate: true,
      menteeReflection: true,
      mentor: { select: { name: true, mentorProfile: { select: { id: true } } } },
      mentee: { select: { name: true, menteeProfile: { select: { id: true } } } },
      cohort: { select: { name: true } },
    },
  });

  return logs.map((l) => ({
    id: l.id,
    date: l.date,
    time: l.time,
    meetingType: l.meetingType,
    competencyDiscussed: l.competencyDiscussed,
    goalDiscussed: l.goalDiscussed,
    // Prefer the AI summary (what the mentor accepted) and fall back to the raw notes.
    summary: l.aiSummary ?? l.discussionSummary,
    actionsAgreed: l.actionsAgreed,
    challenges: l.challenges,
    resourcesNeeded: l.resourcesNeeded,
    nextActionPlan: l.nextActionPlan,
    timeline: l.timeline,
    nextMeetingDate: l.nextMeetingDate,
    menteeReflection: l.menteeReflection,
    mentorName: l.mentor.name,
    mentorProfileId: l.mentor.mentorProfile?.id ?? null,
    menteeName: l.mentee.name,
    menteeProfileId: l.mentee.menteeProfile?.id ?? null,
    cohortName: l.cohort.name,
  }));
}
