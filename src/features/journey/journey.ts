// Mentorship Journey Tracker (experience-layer.md §1.2). Pure, unit-tested engine:
// given facts gathered from real records, it computes the state of each step in
// the 9-month journey. No I/O here — the data layer fills JourneyFacts; this maps
// facts → states. "Computed from real data, never manually set" (§1.2).

export const JOURNEY_STEPS = [
  'profile',
  'training',
  'matched',
  'confidentiality',
  'goals',
  'sessions',
  'midterm',
  'final',
  'completion',
] as const;

export type JourneyStepKey = (typeof JOURNEY_STEPS)[number];

// Four states (§1.2). `needs_action` = the user's turn now; `overdue` = a
// needs_action that has blown a soft deadline; `pending` = upstream not ready /
// not yet the user's move; `completed` = done.
export type JourneyState = 'completed' | 'needs_action' | 'overdue' | 'pending';

export type JourneyRole = 'mentee' | 'mentor';

export interface JourneyFacts {
  role: JourneyRole;
  profileComplete: boolean;
  trainingCompleted: boolean;
  trainingInProgress: boolean;
  matched: boolean;
  matchedAt: Date | null;
  confidentialitySigned: boolean;
  // For a mentee: they submitted/were-approved their own goals. For a mentor:
  // at least one paired mentee has submitted / been approved.
  goalsSubmitted: boolean;
  goalsApproved: boolean;
  sessionCount: number;
  lastSessionAt: Date | null;
  // Per-user review completion isn't modelled until M3 — passed as false for now.
  midtermDone: boolean;
  finalDone: boolean;
  now: Date;
}

export interface JourneyStep {
  key: JourneyStepKey;
  state: JourneyState;
  /** Deep link to the relevant page, or null when that page isn't built yet. */
  link: string | null;
}

export interface JourneyResult {
  steps: JourneyStep[];
  progressPercent: number;
  /** The single step the user should focus on now (first needs_action/overdue,
   *  else first pending), or null when the journey is complete. */
  currentStepKey: JourneyStepKey | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Soft deadlines for the overdue calculation (calendar-driven, cohort-tunable
// later; sensible defaults for now).
const CONFIDENTIALITY_OVERDUE_DAYS = 14;
const GOALS_OVERDUE_DAYS = 30;
const SESSION_DUE_DAYS = 35;
const SESSION_OVERDUE_DAYS = 60;

function daysSince(now: Date, then: Date | null): number | null {
  if (!then) return null;
  return Math.floor((now.getTime() - then.getTime()) / DAY_MS);
}

function profileState(f: JourneyFacts): JourneyState {
  return f.profileComplete ? 'completed' : 'needs_action';
}

function trainingState(f: JourneyFacts): JourneyState {
  if (f.trainingCompleted) return 'completed';
  if (f.trainingInProgress) return 'needs_action';
  return f.profileComplete ? 'needs_action' : 'pending';
}

function matchedState(f: JourneyFacts): JourneyState {
  // Matching is admin-driven; the participant waits, so it is never needs_action.
  return f.matched ? 'completed' : 'pending';
}

function confidentialityState(f: JourneyFacts): JourneyState {
  if (f.confidentialitySigned) return 'completed';
  if (!f.matched) return 'pending';
  const age = daysSince(f.now, f.matchedAt);
  if (age !== null && age > CONFIDENTIALITY_OVERDUE_DAYS) return 'overdue';
  return 'needs_action';
}

function goalsState(f: JourneyFacts): JourneyState {
  if (f.role === 'mentor') {
    if (f.goalsApproved) return 'completed';
    if (f.goalsSubmitted) return 'needs_action'; // a mentee's goal awaits review
    return 'pending';
  }
  // Mentee
  if (f.goalsSubmitted || f.goalsApproved) return 'completed';
  if (!f.confidentialitySigned) return 'pending';
  const age = daysSince(f.now, f.matchedAt);
  if (age !== null && age > GOALS_OVERDUE_DAYS) return 'overdue';
  return 'needs_action';
}

function sessionsState(f: JourneyFacts): JourneyState {
  if (!f.matched) return 'pending';
  if (f.sessionCount === 0) {
    const age = daysSince(f.now, f.matchedAt);
    if (age !== null && age > GOALS_OVERDUE_DAYS) return 'overdue';
    return 'needs_action';
  }
  const gap = daysSince(f.now, f.lastSessionAt);
  if (gap === null) return 'completed';
  if (gap > SESSION_OVERDUE_DAYS) return 'overdue';
  if (gap > SESSION_DUE_DAYS) return 'needs_action';
  return 'completed';
}

function reviewState(done: boolean): JourneyState {
  // Per-user review state lands in M3; until then a not-done review is upcoming.
  return done ? 'completed' : 'pending';
}

function completionState(f: JourneyFacts): JourneyState {
  const earned =
    f.trainingCompleted && f.goalsApproved && f.midtermDone && f.finalDone;
  return earned ? 'completed' : 'pending';
}

const LINKS: Record<JourneyStepKey, string | null> = {
  profile: '/profile',
  training: null,
  matched: null,
  confidentiality: '/agreements',
  goals: '/goals',
  sessions: '/sessions',
  midterm: '/mid-term-review',
  final: '/final-review',
  completion: '/certificate',
};

export function computeJourney(facts: JourneyFacts): JourneyResult {
  const stateByKey: Record<JourneyStepKey, JourneyState> = {
    profile: profileState(facts),
    training: trainingState(facts),
    matched: matchedState(facts),
    confidentiality: confidentialityState(facts),
    goals: goalsState(facts),
    sessions: sessionsState(facts),
    midterm: reviewState(facts.midtermDone),
    final: reviewState(facts.finalDone),
    completion: completionState(facts),
  };

  const steps: JourneyStep[] = JOURNEY_STEPS.map((key) => ({
    key,
    state: stateByKey[key],
    link: LINKS[key],
  }));

  const completed = steps.filter((s) => s.state === 'completed').length;
  const progressPercent = Math.round((completed / steps.length) * 100);

  const actionable = steps.find((s) => s.state === 'needs_action' || s.state === 'overdue');
  const pending = steps.find((s) => s.state === 'pending');
  const currentStepKey = actionable?.key ?? pending?.key ?? null;

  return { steps, progressPercent, currentStepKey };
}
