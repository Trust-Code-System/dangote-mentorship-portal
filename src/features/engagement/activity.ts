// ──────────────────────────────────────────────────────────────────────────
// Person-level engagement (pure — no I/O, fully unit tested).
//
// The existing risk monitor (features/risk) judges matched PAIRS. This judges
// PEOPLE: who has gone quiet, and how long for. Different question, different
// answer — a pair can look fine on session count while one side has done
// nothing for a month.
//
// CONFIDENTIALITY: activity is derived from metadata only — timestamps and
// counts. Message *content* is never read, and neither is reflection or private
// note content (CLAUDE.md §7, §10: admins see activity metadata, never bodies).
// The signals below are deliberately all "when did X last happen".
// ──────────────────────────────────────────────────────────────────────────

/** The kinds of activity that count as someone using the programme. */
export const ACTIVITY_SIGNALS = [
  /** Logged, or was the subject of, a mentoring session. */
  'session',
  /** Created or updated a goal. */
  'goal',
  /** Submitted a form: assessment, monthly meeting form, or review. */
  'form',
  /** Scheduled or attended a meeting. */
  'meeting',
  /** Wrote a reflection journal entry (existence only, never the text). */
  'reflection',
  /** Sent a message (timestamp only, never the body). */
  'message',
] as const;

export type ActivitySignal = (typeof ACTIVITY_SIGNALS)[number];

/** Last time each signal fired for one person. Missing = never. */
export type SignalDates = Partial<Record<ActivitySignal, Date | null>>;

export type EngagementState =
  /** Active recently. */
  | 'active'
  /** Slipping — worth a nudge, not an alarm. */
  | 'quiet'
  /** Long enough to need a human to intervene. */
  | 'inactive'
  /** Has never done anything, and has been enrolled long enough that they should have. */
  | 'never';

export interface EngagementThresholds {
  /** Days of silence before someone is "quiet". */
  quietAfterDays: number;
  /** Days of silence before someone is "inactive". */
  inactiveAfterDays: number;
  /**
   * Grace period for a brand-new joiner. Someone enrolled three days ago has
   * not "gone quiet"; they have not started. Without this, every new intake
   * lights up the report red on day one.
   */
  newJoinerGraceDays: number;
}

export const DEFAULT_ENGAGEMENT_THRESHOLDS: EngagementThresholds = {
  quietAfterDays: 10,
  inactiveAfterDays: 21,
  newJoinerGraceDays: 7,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between two instants, floored, never negative. */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/** The most recent of a set of signal dates, or null when none fired. */
export function lastActiveFrom(signals: SignalDates): Date | null {
  let latest: Date | null = null;
  for (const value of Object.values(signals)) {
    if (!value) continue;
    if (!latest || value.getTime() > latest.getTime()) latest = value;
  }
  return latest;
}

/** Which signal produced the most recent activity, for the "what they last did" column. */
export function lastSignalFrom(signals: SignalDates): ActivitySignal | null {
  let best: { signal: ActivitySignal; at: Date } | null = null;
  for (const signal of ACTIVITY_SIGNALS) {
    const at = signals[signal];
    if (!at) continue;
    if (!best || at.getTime() > best.at.getTime()) best = { signal, at };
  }
  return best?.signal ?? null;
}

export interface EngagementAssessment {
  state: EngagementState;
  /** Days since last activity; null when they have never been active. */
  daysSinceActive: number | null;
  /** Days since they were enrolled. */
  daysSinceJoined: number;
  lastActiveAt: Date | null;
  lastSignal: ActivitySignal | null;
}

/**
 * Classify one person's engagement.
 *
 * The new-joiner grace period applies to *both* the never-active and the
 * gone-quiet paths: someone who joined two days ago is `active` regardless,
 * because there has not yet been time for silence to mean anything.
 */
export function assessEngagement(
  input: { joinedAt: Date; signals: SignalDates },
  now: Date,
  thresholds: EngagementThresholds = DEFAULT_ENGAGEMENT_THRESHOLDS,
): EngagementAssessment {
  const lastActiveAt = lastActiveFrom(input.signals);
  const lastSignal = lastSignalFrom(input.signals);
  const daysSinceJoined = daysBetween(input.joinedAt, now);
  const daysSinceActive = lastActiveAt ? daysBetween(lastActiveAt, now) : null;

  const base = { daysSinceActive, daysSinceJoined, lastActiveAt, lastSignal };

  // Too new to judge — on either path.
  if (daysSinceJoined < thresholds.newJoinerGraceDays) {
    return { state: 'active', ...base };
  }

  if (daysSinceActive === null) {
    return { state: 'never', ...base };
  }
  if (daysSinceActive >= thresholds.inactiveAfterDays) {
    return { state: 'inactive', ...base };
  }
  if (daysSinceActive >= thresholds.quietAfterDays) {
    return { state: 'quiet', ...base };
  }
  return { state: 'active', ...base };
}

/** True for the states an admin should actually do something about. */
export function needsAttention(state: EngagementState): boolean {
  return state === 'inactive' || state === 'never';
}

export interface EngagementSummary {
  total: number;
  active: number;
  quiet: number;
  inactive: number;
  never: number;
  /** inactive + never — the headline number for the weekly report. */
  needsAttention: number;
}

export function summarizeEngagement(states: EngagementState[]): EngagementSummary {
  const summary: EngagementSummary = {
    total: states.length,
    active: 0,
    quiet: 0,
    inactive: 0,
    never: 0,
    needsAttention: 0,
  };
  for (const state of states) {
    summary[state] += 1;
    if (needsAttention(state)) summary.needsAttention += 1;
  }
  return summary;
}

/**
 * Sort worst-first, so the people who need attention are at the top of the
 * admin's list and the report without anyone having to sort a column.
 *
 * `never` outranks `inactive` because someone who has never engaged at all is
 * a different (and usually more urgent) problem than someone who has stopped.
 */
const STATE_ORDER: Record<EngagementState, number> = {
  never: 0,
  inactive: 1,
  quiet: 2,
  active: 3,
};

export function compareByConcern(
  a: Pick<EngagementAssessment, 'state' | 'daysSinceActive'>,
  b: Pick<EngagementAssessment, 'state' | 'daysSinceActive'>,
): number {
  const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state];
  if (byState !== 0) return byState;
  // Within a state, longest silence first. `never` has no silence figure, so
  // fall back to equal and let the caller's stable sort keep name order.
  return (b.daysSinceActive ?? 0) - (a.daysSinceActive ?? 0);
}
