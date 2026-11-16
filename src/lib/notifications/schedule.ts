import { MeetingStatus } from '@prisma/client';

// Pure scheduling predicates for the cron-driven notification emitters
// (experience-layer.md §1.10). No I/O — the orchestrator in cron.ts loads the
// records, applies these rules, dedupes, and emits. Kept free of `server-only`/
// Prisma so the timing logic is unit-tested in isolation.

const HOUR_MS = 60 * 60 * 1000;

export interface MeetingReminderInput {
  status: MeetingStatus;
  startsAt: Date | null;
  didHappen: boolean | null;
}

/**
 * A still-scheduled meeting starting within the reminder window ([now, now+H])
 * is due a "meeting_reminder". Past, cancelled, or already-resolved meetings are
 * not. Dedup (one reminder per meeting per participant) is the caller's job.
 */
export function needsMeetingReminder(
  m: MeetingReminderInput,
  now: Date,
  windowHours = 24,
): boolean {
  if (m.status !== MeetingStatus.SCHEDULED) return false;
  if (m.didHappen !== null) return false;
  if (!m.startsAt) return false;
  const t = m.startsAt.getTime();
  return t >= now.getTime() && t <= now.getTime() + windowHours * HOUR_MS;
}

export interface SessionLogReminderInput {
  status: MeetingStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  didHappen: boolean | null;
  hasSessionLog: boolean;
}

/**
 * A meeting whose time has passed (beyond a short grace) with no session log and
 * which was not a confirmed no-show is due a "session_log_due" nudge to the
 * mentee (mentees record logs). A cancelled or already-logged meeting
 * is not. didHappen === false (a recorded no-show) is excluded; true and null
 * (unconfirmed) both still want a log.
 */
export function needsSessionLogReminder(
  m: SessionLogReminderInput,
  now: Date,
  graceHours = 2,
): boolean {
  if (m.status === MeetingStatus.CANCELLED) return false;
  if (m.didHappen === false) return false;
  if (m.hasSessionLog) return false;
  const end = m.endsAt ?? m.startsAt;
  if (!end) return false;
  return end.getTime() + graceHours * HOUR_MS < now.getTime();
}

export interface MentorProfileCompleteness {
  department: string | null;
  jobTitle: string | null;
  yearsExperience: number | null;
  whyMentor: string | null;
  availability: string | null;
}

/** A mentor profile missing any core matching/reporting field is incomplete. */
export function isMentorProfileIncomplete(p: MentorProfileCompleteness): boolean {
  return (
    !p.department ||
    !p.jobTitle ||
    p.yearsExperience == null ||
    !p.whyMentor ||
    !p.availability
  );
}

export interface MenteeProfileCompleteness {
  department: string | null;
  jobTitle: string | null;
  careerGoals: string | null;
  whyMentor: string | null;
}

/** A mentee profile missing any core matching field is incomplete. */
export function isMenteeProfileIncomplete(p: MenteeProfileCompleteness): boolean {
  return !p.department || !p.jobTitle || !p.careerGoals || !p.whyMentor;
}
