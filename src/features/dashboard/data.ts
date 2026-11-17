import 'server-only';
import {
  ActionItemStatus,
  ClinicStatus,
  GoalStatus,
  Language,
  MatchStatus,
  MatchingStatus,
  MeetingStatus,
  TrainingStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getMenteePairing, getMentorPairings } from '@/lib/pairings';
import { stageProgressPercent } from '@/features/goals/stage';

// Read models for the personalized role dashboards (experience-layer.md §1.1).
// Each answers "what matters to me right now," above the fold, from real records
// (the next clinic and cohort resources are read from seeded data; RSVP/upload
// management land with the full M4 clinic + resource tooling).

const ACTIVE_ITEM_STATUSES: ActionItemStatus[] = [
  ActionItemStatus.OPEN,
  ActionItemStatus.IN_PROGRESS,
  ActionItemStatus.BLOCKED,
];
const LIVE_GOAL_STATUSES: GoalStatus[] = [
  GoalStatus.SUBMITTED,
  GoalStatus.APPROVED,
  GoalStatus.REJECTED,
  GoalStatus.COMPLETED,
];

// ── Mentee ────────────────────────────────────────────────────────────────────

export interface MenteeDashboard {
  mentor: {
    id: string;
    name: string | null;
    language: Language | null;
    department: string | null;
    jobTitle: string | null;
  } | null;
  nextMeeting: { id: string; title: string; startsAt: Date | null } | null;
  goals: { id: string; title: string; status: GoalStatus; percent: number }[];
  actionItems: {
    id: string;
    title: string;
    dueDate: Date | null;
    status: ActionItemStatus;
    overdue: boolean;
  }[];
  nextClinic: {
    id: string;
    title: string;
    topic: string | null;
    scheduledAt: Date | null;
    joinUrl: string | null;
  } | null;
  resources: { id: string; title: string; url: string | null; category: string | null }[];
}

export async function getMenteeDashboard(userId: string): Promise<MenteeDashboard> {
  const pairing = await getMenteePairing(userId);
  const now = new Date();

  const [mentorProfile, nextMeeting, goals, actionItems, nextClinic, resources] = await Promise.all(
    [
      pairing
        ? prisma.mentorProfile.findFirst({
            where: { userId: pairing.mentorId, cohortId: pairing.cohortId, deletedAt: null },
            select: { department: true, jobTitle: true, preferredLanguage: true },
          })
        : Promise.resolve(null),
      pairing
        ? prisma.meeting.findFirst({
            where: {
              menteeId: userId,
              cohortId: pairing.cohortId,
              deletedAt: null,
              status: MeetingStatus.SCHEDULED,
              didHappen: null,
              startsAt: { gte: now },
            },
            orderBy: { startsAt: 'asc' },
            select: { id: true, title: true, startsAt: true },
          })
        : Promise.resolve(null),
      prisma.goal.findMany({
        where: {
          menteeId: userId,
          cohortId: pairing?.cohortId ?? '',
          deletedAt: null,
          status: { in: LIVE_GOAL_STATUSES },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, stage: true },
      }),
      prisma.actionItem.findMany({
        where: {
          assigneeId: userId,
          cohortId: pairing?.cohortId ?? '',
          deletedAt: null,
          status: { in: ACTIVE_ITEM_STATUSES },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: 6,
        select: { id: true, title: true, dueDate: true, status: true },
      }),
      // Next upcoming clinic for the cohort (CLAUDE.md §10) — read-only here.
      pairing
        ? prisma.clinic.findFirst({
            where: {
              cohortId: pairing.cohortId,
              deletedAt: null,
              status: ClinicStatus.SCHEDULED,
              scheduledAt: { gte: now },
            },
            orderBy: { scheduledAt: 'asc' },
            select: { id: true, title: true, topic: true, scheduledAt: true, joinUrl: true },
          })
        : Promise.resolve(null),
      // Cohort resources, in the mentee's language first.
      pairing
        ? prisma.resource.findMany({
            where: { cohortId: pairing.cohortId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, title: true, url: true, category: true },
          })
        : Promise.resolve([]),
    ],
  );

  return {
    mentor: pairing
      ? {
          id: pairing.mentorId,
          name: pairing.mentorName,
          language: mentorProfile?.preferredLanguage ?? null,
          department: mentorProfile?.department ?? null,
          jobTitle: mentorProfile?.jobTitle ?? null,
        }
      : null,
    nextMeeting,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      percent: stageProgressPercent(g.stage),
    })),
    actionItems: actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
      status: a.status,
      overdue: a.dueDate !== null && a.dueDate.getTime() < now.getTime(),
    })),
    nextClinic,
    resources,
  };
}

// ── Mentor ────────────────────────────────────────────────────────────────────

export interface MentorDashboard {
  mentees: { id: string; name: string | null; language: Language | null }[];
  pendingReviewCount: number;
  nextMeetings: {
    id: string;
    title: string;
    startsAt: Date | null;
    counterpartName: string | null;
  }[];
  logsAwaiting: number;
}

export async function getMentorDashboard(userId: string): Promise<MentorDashboard> {
  const pairings = await getMentorPairings(userId);
  const menteeIds = pairings.map((p) => p.menteeId);
  const now = new Date();

  const [profiles, pendingReviewCount, nextMeetings, logsAwaiting] = await Promise.all([
    menteeIds.length
      ? prisma.menteeProfile.findMany({
          where: { userId: { in: menteeIds }, deletedAt: null },
          select: { userId: true, preferredLanguage: true },
        })
      : Promise.resolve([]),
    menteeIds.length
      ? prisma.goal.count({
          where: { menteeId: { in: menteeIds }, deletedAt: null, status: GoalStatus.SUBMITTED },
        })
      : Promise.resolve(0),
    prisma.meeting.findMany({
      where: {
        mentorId: userId,
        deletedAt: null,
        status: MeetingStatus.SCHEDULED,
        didHappen: null,
        startsAt: { gte: now },
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
      include: { mentee: { select: { name: true } } },
    }),
    // Meetings that took place but still have no session log (§1.1 "awaiting completion").
    prisma.meeting.count({
      where: {
        mentorId: userId,
        deletedAt: null,
        didHappen: true,
        sessionLogs: { none: { deletedAt: null } },
      },
    }),
  ]);

  const langByMentee = new Map(profiles.map((p) => [p.userId, p.preferredLanguage]));

  return {
    mentees: pairings.map((p) => ({
      id: p.menteeId,
      name: p.menteeName,
      language: langByMentee.get(p.menteeId) ?? null,
    })),
    pendingReviewCount,
    nextMeetings: nextMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt,
      counterpartName: m.mentee.name,
    })),
    logsAwaiting,
  };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminDashboard {
  activePairs: number;
  unmatchedMentees: number;
  unmatchedMentors: number;
  goalsSubmitted: number;
  goalsApproved: number;
  upcomingMeetings: number;
  openSupport: number;
  mentorsTrained: number;
  menteesTrained: number;
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const now = new Date();
  const [
    activePairs,
    unmatchedMentees,
    unmatchedMentors,
    goalsSubmitted,
    goalsApproved,
    upcomingMeetings,
    openSupport,
    mentorsTrained,
    menteesTrained,
  ] = await Promise.all([
    prisma.match.count({ where: { status: MatchStatus.ACCEPTED, deletedAt: null } }),
    prisma.menteeProfile.count({
      where: { deletedAt: null, matchingStatus: MatchingStatus.UNMATCHED },
    }),
    prisma.mentorProfile.count({
      where: { deletedAt: null, matchingStatus: MatchingStatus.UNMATCHED },
    }),
    prisma.goal.count({ where: { deletedAt: null, status: GoalStatus.SUBMITTED } }),
    prisma.goal.count({
      where: { deletedAt: null, status: { in: [GoalStatus.APPROVED, GoalStatus.COMPLETED] } },
    }),
    prisma.meeting.count({
      where: {
        deletedAt: null,
        status: MeetingStatus.SCHEDULED,
        didHappen: null,
        startsAt: { gte: now },
      },
    }),
    prisma.supportRequest.count({ where: { deletedAt: null, status: 'OPEN' } }),
    prisma.mentorProfile.count({
      where: { deletedAt: null, trainingStatus: TrainingStatus.COMPLETED },
    }),
    prisma.menteeProfile.count({
      where: { deletedAt: null, trainingStatus: TrainingStatus.COMPLETED },
    }),
  ]);

  return {
    activePairs,
    unmatchedMentees,
    unmatchedMentors,
    goalsSubmitted,
    goalsApproved,
    upcomingMeetings,
    openSupport,
    mentorsTrained,
    menteesTrained,
  };
}
