import 'server-only';
import {
  ActionItemStatus,
  AgreementType,
  GoalStage,
  GoalStatus,
  Language,
  MatchStatus,
  MeetingStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getMentorPairings } from '@/lib/pairings';
import { pairAccessFromMatch, type PairRole } from './access';
import { getCertificateData } from '@/features/certificate/data';

// All Pair Contract Page I/O (experience-layer.md §1.8). The page is the shared
// home base for one matched pair: it aggregates the records the pair already
// owns (agreements, meetings, goals, sessions, action items) into one view.
// Access is resolved + authorized off the accepted Match via the pure
// pairAccessFromMatch rule, then everything is scoped to that pair.

export interface PairPerson {
  id: string;
  name: string | null;
  language: Language | null;
  department: string | null;
  jobTitle: string | null;
  phone: string | null;
  availability: string | null;
}

export interface PairAgreementStatus {
  type: AgreementType;
  mentorSignedAt: Date | null;
  menteeSignedAt: Date | null;
}

export interface PairGoalSummary {
  id: string;
  title: string;
  status: GoalStatus;
  stage: GoalStage;
}

export interface PairActionItem {
  id: string;
  title: string;
  dueDate: Date | null;
  status: ActionItemStatus;
  assigneeName: string | null;
  overdue: boolean;
}

export interface PairMeetingSummary {
  id: string;
  title: string;
  startsAt: Date | null;
}

export interface PairWorkspace {
  role: PairRole;
  cohortId: string;
  cohortName: string;
  mentor: PairPerson;
  mentee: PairPerson;
  agreements: PairAgreementStatus[];
  goals: PairGoalSummary[];
  nextMeeting: PairMeetingSummary | null;
  meetingCount: number;
  sessionCount: number;
  lastSessionAt: Date | null;
  openActionItems: PairActionItem[];
  totalActionCount: number;
  certificateEarned: boolean;
  latestSession: { id: string; date: Date | null; title: string } | null;
}

const ACTIVE_ACTION_STATUSES: ActionItemStatus[] = [
  ActionItemStatus.OPEN,
  ActionItemStatus.IN_PROGRESS,
  ActionItemStatus.BLOCKED,
];

function person(
  user: { id: string; name: string | null },
  mentor: {
    department: string | null;
    jobTitle: string | null;
    phone: string | null;
    preferredLanguage: Language;
    availability: string | null;
  } | null,
  mentee: {
    department: string | null;
    jobTitle: string | null;
    phone: string | null;
    preferredLanguage: Language;
  } | null,
): PairPerson {
  const profile = mentor ?? mentee;
  return {
    id: user.id,
    name: user.name,
    language: profile?.preferredLanguage ?? null,
    department: profile?.department ?? null,
    jobTitle: profile?.jobTitle ?? null,
    phone: profile?.phone ?? null,
    availability: mentor?.availability ?? null,
  };
}

/**
 * The full workspace for the pair identified by menteeId, as seen by viewerId,
 * or null when the viewer is not part of that accepted pair. Only submitted
 * goals are shared; the mentee's private drafts are excluded.
 */
export async function getPairWorkspace(
  viewerId: string,
  menteeId: string,
): Promise<PairWorkspace | null> {
  const match = await prisma.match.findFirst({
    where: { menteeId, status: MatchStatus.ACCEPTED, deletedAt: null },
    orderBy: { acceptedAt: 'desc' },
    include: {
      cohort: { select: { name: true } },
      mentor: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true } },
    },
  });

  const role = pairAccessFromMatch(match, viewerId);
  if (!match || !role) return null;

  const mentorId = match.mentor.id;
  const { cohortId } = match;
  const now = new Date();

  // A failed query must not turn into a fabricated zero or completed milestone.
  const [
    mentorProfile,
    menteeProfile,
    agreements,
    goals,
    nextMeeting,
    meetingCount,
    sessionAgg,
    actionItems,
    totalActionCount,
    latestSession,
    certificate,
  ] = await Promise.all([
    prisma.mentorProfile.findFirst({
      where: { userId: mentorId, cohortId, deletedAt: null },
      select: {
        department: true,
        jobTitle: true,
        phone: true,
        preferredLanguage: true,
        availability: true,
      },
    }),
    prisma.menteeProfile.findFirst({
      where: { userId: menteeId, cohortId, deletedAt: null },
      select: { department: true, jobTitle: true, phone: true, preferredLanguage: true },
    }),
    prisma.agreement.findMany({
      where: {
        signedById: { in: [mentorId, menteeId] },
        cohortId,
        signedAt: { not: null },
        deletedAt: null,
      },
      select: { type: true, signedById: true, signedAt: true },
    }),
    prisma.goal.findMany({
      where: { menteeId, cohortId, deletedAt: null, status: { not: GoalStatus.DRAFT } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, stage: true },
    }),
    prisma.meeting.findFirst({
      where: {
        mentorId,
        menteeId,
        cohortId,
        deletedAt: null,
        status: MeetingStatus.SCHEDULED,
        didHappen: null,
        startsAt: { gte: now },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, title: true, startsAt: true },
    }),
    prisma.meeting.count({
      where: { mentorId, menteeId, cohortId, deletedAt: null, didHappen: true },
    }),
    prisma.sessionLog.aggregate({
      where: { mentorId, menteeId, cohortId, deletedAt: null },
      _count: { _all: true },
      _max: { date: true },
    }),
    prisma.actionItem.findMany({
      where: {
        cohortId,
        deletedAt: null,
        status: { in: ACTIVE_ACTION_STATUSES },
        sessionLog: { mentorId, menteeId, deletedAt: null },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: { assignee: { select: { name: true } } },
    }),
    prisma.actionItem.count({
      where: { cohortId, deletedAt: null, sessionLog: { mentorId, menteeId, deletedAt: null } },
    }),
    prisma.sessionLog.findFirst({
      where: { cohortId, mentorId, menteeId, deletedAt: null },
      orderBy: [{ date: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      select: { id: true, date: true, competencyDiscussed: true },
    }),
    getCertificateData(menteeId),
  ]);

  const agreementStatus = (type: AgreementType): PairAgreementStatus => ({
    type,
    mentorSignedAt:
      agreements.find((a) => a.type === type && a.signedById === mentorId)?.signedAt ?? null,
    menteeSignedAt:
      agreements.find((a) => a.type === type && a.signedById === menteeId)?.signedAt ?? null,
  });

  return {
    role,
    cohortId,
    cohortName: match.cohort.name,
    mentor: person(match.mentor, mentorProfile, null),
    mentee: person(match.mentee, null, menteeProfile),
    agreements: [
      agreementStatus(AgreementType.MENTORING),
      agreementStatus(AgreementType.CONFIDENTIALITY),
    ],
    goals,
    nextMeeting: nextMeeting
      ? { id: nextMeeting.id, title: nextMeeting.title, startsAt: nextMeeting.startsAt }
      : null,
    meetingCount,
    sessionCount: sessionAgg._count._all,
    lastSessionAt: sessionAgg._max.date ?? null,
    totalActionCount,
    certificateEarned: certificate?.matchId === match.id && certificate.earned,
    latestSession: latestSession
      ? {
          id: latestSession.id,
          date: latestSession.date,
          title: latestSession.competencyDiscussed || 'Mentoring session',
        }
      : null,
    openActionItems: actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
      status: a.status,
      assigneeName: a.assignee?.name ?? null,
      overdue: a.dueDate !== null && a.dueDate.getTime() < now.getTime(),
    })),
  };
}

export interface PairLink {
  menteeId: string;
  menteeName: string | null;
}

/** The pairs the user can open: a mentee has their own; a mentor has each mentee. */
export async function getViewablePairs(
  userId: string,
  roles: { isMentor: boolean; isMentee: boolean },
): Promise<PairLink[]> {
  const links: PairLink[] = [];
  if (roles.isMentee) {
    const own = await prisma.match.findFirst({
      where: { menteeId: userId, status: MatchStatus.ACCEPTED, deletedAt: null },
      select: { id: true },
    });
    if (own) links.push({ menteeId: userId, menteeName: null });
  }
  if (roles.isMentor) {
    const pairings = await getMentorPairings(userId);
    for (const p of pairings) links.push({ menteeId: p.menteeId, menteeName: p.menteeName });
  }
  return links;
}
