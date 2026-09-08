import 'server-only';
import { ReviewStatus, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { isRecurringFormType, rolesRequiredFor } from '@/features/assessments/participants';
import {
  DEFAULT_ENGAGEMENT_THRESHOLDS,
  assessEngagement,
  compareByConcern,
  summarizeEngagement,
  type ActivitySignal,
  type EngagementState,
  type EngagementSummary,
  type EngagementThresholds,
  type SignalDates,
} from './activity';

// Person-level engagement reads (CLAUDE.md §9.8 Risk & Engagement Monitor).
//
// CONFIDENTIALITY: every query below selects TIMESTAMPS AND IDS ONLY. Messages
// contribute `createdAt` and nothing else — never `bodyOriginal`. Reflection
// journal entries contribute their existence, never their text. That is the
// §7/§10 posture: admins see activity metadata, never content. If you extend
// this file, keep it that way.

export interface EngagementRow {
  userId: string;
  name: string | null;
  email: string;
  /** MENTOR or MENTEE. Someone holding both is listed under mentee. */
  role: RoleName;
  joinedAt: Date;
  state: EngagementState;
  lastActiveAt: Date | null;
  daysSinceActive: number | null;
  daysSinceJoined: number;
  lastSignal: ActivitySignal | null;
  /** Recurring forms they owe and have not submitted (count only). */
  outstandingForms: number;
}

export interface CohortEngagement {
  cohortId: string;
  cohortName: string;
  thresholds: EngagementThresholds;
  summary: EngagementSummary;
  /** Worst-first: never-active, then longest silence. */
  rows: EngagementRow[];
  generatedAt: Date;
}

/** Latest date per user from a list of {userId, at} pairs. */
function foldLatest(
  target: Map<string, SignalDates>,
  signal: ActivitySignal,
  entries: { userId: string; at: Date | null }[],
): void {
  for (const entry of entries) {
    if (!entry.at) continue;
    const existing = target.get(entry.userId) ?? {};
    const current = existing[signal];
    if (!current || entry.at.getTime() > current.getTime()) {
      existing[signal] = entry.at;
      target.set(entry.userId, existing);
    }
  }
}

/**
 * Every mentor and mentee in the cohort, with when they were last active and
 * what they last did.
 *
 * One query per signal rather than a join per person: the cohort is a few
 * hundred people at most, and six bounded queries beat N round-trips.
 */
export async function getCohortEngagement(
  cohortId: string,
  thresholds: EngagementThresholds = DEFAULT_ENGAGEMENT_THRESHOLDS,
  now: Date = new Date(),
): Promise<CohortEngagement | null> {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!cohort) return null;

  const grants = await prisma.userRole.findMany({
    where: {
      cohortId,
      deletedAt: null,
      role: { name: { in: [RoleName.MENTOR, RoleName.MENTEE] } },
      user: { isActive: true, deletedAt: null },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      role: { select: { name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (grants.length === 0) {
    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      thresholds,
      summary: summarizeEngagement([]),
      rows: [],
      generatedAt: now,
    };
  }

  // A person holding both roles is listed once, as a mentee (the side with the
  // development goals), matching respondentRoleFor()'s preference.
  const people = new Map<
    string,
    { name: string | null; email: string; role: RoleName; joinedAt: Date }
  >();
  for (const grant of grants) {
    const existing = people.get(grant.user.id);
    const role = grant.role.name;
    if (!existing) {
      people.set(grant.user.id, {
        name: grant.user.name,
        email: grant.user.email,
        role,
        joinedAt: grant.createdAt,
      });
      continue;
    }
    if (role === RoleName.MENTEE) existing.role = RoleName.MENTEE;
    if (grant.createdAt.getTime() < existing.joinedAt.getTime()) {
      existing.joinedAt = grant.createdAt;
    }
  }

  const userIds = Array.from(people.keys());

  const [sessions, goals, forms, meetings, reflections, messages] = await Promise.all([
    // Sessions count for BOTH sides of the pair — a session that happened is
    // engagement by the mentor who logged it and the mentee who attended.
    prisma.sessionLog.findMany({
      where: { cohortId, deletedAt: null },
      select: { mentorId: true, menteeId: true, date: true, createdAt: true },
    }),
    prisma.goal.findMany({
      where: { cohortId, deletedAt: null, menteeId: { in: userIds } },
      select: { menteeId: true, updatedAt: true },
    }),
    prisma.formResponse.findMany({
      where: {
        respondentId: { in: userIds },
        status: ReviewStatus.SUBMITTED,
        deletedAt: null,
        form: { cohortId },
      },
      select: { respondentId: true, submittedAt: true },
    }),
    prisma.meeting.findMany({
      where: { cohortId, deletedAt: null },
      select: { mentorId: true, menteeId: true, startsAt: true, createdAt: true },
    }),
    // Existence and timing only — never the entry text.
    prisma.reflectionJournalEntry.findMany({
      where: { cohortId, deletedAt: null, authorId: { in: userIds } },
      select: { authorId: true, createdAt: true },
    }),
    // METADATA ONLY: senderId + createdAt. The body is never selected.
    prisma.message.findMany({
      where: { deletedAt: null, senderId: { in: userIds }, conversation: { cohortId } },
      select: { senderId: true, createdAt: true },
    }),
  ]);

  const signalsByUser = new Map<string, SignalDates>();

  foldLatest(signalsByUser, 'session', [
    ...sessions.map((s) => ({ userId: s.mentorId, at: s.date ?? s.createdAt })),
    ...sessions.map((s) => ({ userId: s.menteeId, at: s.date ?? s.createdAt })),
  ]);
  foldLatest(
    signalsByUser,
    'goal',
    goals.map((g) => ({ userId: g.menteeId, at: g.updatedAt })),
  );
  foldLatest(
    signalsByUser,
    'form',
    forms.map((f) => ({ userId: f.respondentId, at: f.submittedAt })),
  );
  foldLatest(signalsByUser, 'meeting', [
    ...meetings.map((m) => ({ userId: m.mentorId, at: m.startsAt ?? m.createdAt })),
    ...meetings.map((m) => ({ userId: m.menteeId, at: m.startsAt ?? m.createdAt })),
  ]);
  foldLatest(
    signalsByUser,
    'reflection',
    reflections.map((r) => ({ userId: r.authorId, at: r.createdAt })),
  );
  foldLatest(
    signalsByUser,
    'message',
    messages.map((m) => ({ userId: m.senderId, at: m.createdAt })),
  );

  const outstanding = await countOutstandingForms(cohortId, people, now);

  const rows: EngagementRow[] = Array.from(people.entries()).map(([userId, person]) => {
    const assessment = assessEngagement(
      { joinedAt: person.joinedAt, signals: signalsByUser.get(userId) ?? {} },
      now,
      thresholds,
    );
    return {
      userId,
      name: person.name,
      email: person.email,
      role: person.role,
      joinedAt: person.joinedAt,
      state: assessment.state,
      lastActiveAt: assessment.lastActiveAt,
      daysSinceActive: assessment.daysSinceActive,
      daysSinceJoined: assessment.daysSinceJoined,
      lastSignal: assessment.lastSignal,
      outstandingForms: outstanding.get(userId) ?? 0,
    };
  });

  // Stable: name order within equal concern.
  rows.sort(
    (a, b) =>
      compareByConcern(a, b) || (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );

  return {
    cohortId: cohort.id,
    cohortName: cohort.name,
    thresholds,
    summary: summarizeEngagement(rows.map((r) => r.state)),
    rows,
    generatedAt: now,
  };
}

/**
 * How many open recurring forms each person owes and has not submitted.
 *
 * Counted per person because the audience differs by form: a mentor owes the
 * quarterly assessment but not the monthly meeting form.
 */
async function countOutstandingForms(
  cohortId: string,
  people: Map<string, { role: RoleName }>,
  now: Date,
): Promise<Map<string, number>> {
  const windows = await prisma.assessmentWindow.findMany({
    where: { cohortId, isActive: true, deletedAt: null, opensAt: { lte: now } },
    select: { id: true, formType: true },
  });
  if (windows.length === 0) return new Map();

  const submitted = await prisma.formResponse.findMany({
    where: {
      assessmentWindowId: { in: windows.map((w) => w.id) },
      status: ReviewStatus.SUBMITTED,
      deletedAt: null,
    },
    select: { assessmentWindowId: true, respondentId: true },
  });
  const done = new Set(submitted.map((s) => `${s.assessmentWindowId}:${s.respondentId}`));

  const counts = new Map<string, number>();
  for (const window of windows) {
    if (!isRecurringFormType(window.formType)) continue;
    const audience = rolesRequiredFor(window.formType);
    for (const [userId, person] of people) {
      if (!audience.includes(person.role)) continue;
      if (done.has(`${window.id}:${userId}`)) continue;
      counts.set(userId, (counts.get(userId) ?? 0) + 1);
    }
  }
  return counts;
}
