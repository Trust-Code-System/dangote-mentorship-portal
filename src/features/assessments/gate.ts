import { addDays, differenceInCalendarDays } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────────
// The assessment gate (pure — no I/O, fully unit tested).
//
// A mentee must submit each quarterly assessment by its due date. After the
// due date they get a grace window (default 7 days, per cohort) during which
// the portal keeps working but warns them. Once the grace runs out the portal
// is blocked for that mentee: every authenticated route redirects to the
// assessment until it is submitted.
//
// Only mentees are gated. Mentors, admins, and anyone without an open window
// are always CLEAR (see requirePortalAccess in ./data.ts for who this runs for).
// ──────────────────────────────────────────────────────────────────────────

export type AssessmentGateState =
  /** Nothing outstanding — full access. */
  | 'CLEAR'
  /** An assessment is open and not yet due. Full access, gentle prompt. */
  | 'DUE'
  /** Past the due date but inside the grace window. Full access + warning. */
  | 'GRACE'
  /** Grace exhausted. Portal blocked until the assessment is submitted. */
  | 'LOCKED';

export interface GateWindow {
  id: string;
  label: string;
  opensAt: Date;
  dueAt: Date;
  graceDays: number;
  /** True when this mentee already submitted this window. */
  submitted: boolean;
}

export interface AssessmentGate {
  state: AssessmentGateState;
  /** True when the portal must be blocked. Convenience for callers. */
  locked: boolean;
  /**
   * The window the mentee needs to act on — the earliest open, unsubmitted one.
   * Null when CLEAR.
   */
  window: GateWindow | null;
  /** When access is (or was) blocked: dueAt + graceDays. Null when CLEAR. */
  lockAt: Date | null;
  /**
   * Whole days from `now` until lockAt. Negative once locked, null when CLEAR.
   * Calendar days, so "due tomorrow" reads as 1 regardless of clock time.
   */
  daysUntilLock: number | null;
}

const CLEAR_GATE: AssessmentGate = {
  state: 'CLEAR',
  locked: false,
  window: null,
  lockAt: null,
  daysUntilLock: null,
};

/** The moment access is blocked for a window. */
export function lockDateFor(window: Pick<GateWindow, 'dueAt' | 'graceDays'>): Date {
  return addDays(window.dueAt, Math.max(0, window.graceDays));
}

/**
 * Evaluate a mentee's assessment obligations.
 *
 * `windows` may be passed in any order and may include future windows and
 * already-submitted ones; this function picks what matters. When several
 * windows are outstanding (a mentee who missed two quarters) the *earliest*
 * one is returned, so they work through the backlog in order.
 */
export function evaluateAssessmentGate(windows: GateWindow[], now: Date): AssessmentGate {
  const outstanding = windows
    .filter((w) => !w.submitted && w.opensAt.getTime() <= now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  const target = outstanding[0];
  if (!target) return CLEAR_GATE;

  const lockAt = lockDateFor(target);
  const daysUntilLock = differenceInCalendarDays(lockAt, now);

  // Locked the moment the grace window has fully elapsed.
  if (now.getTime() >= lockAt.getTime()) {
    return { state: 'LOCKED', locked: true, window: target, lockAt, daysUntilLock };
  }
  if (now.getTime() > target.dueAt.getTime()) {
    return { state: 'GRACE', locked: false, window: target, lockAt, daysUntilLock };
  }
  return { state: 'DUE', locked: false, window: target, lockAt, daysUntilLock };
}

// ── Route allowlist while locked ────────────────────────────────────────────
// A locked mentee can still reach the assessment itself, ask for help, and sign
// out. Everything else in the authenticated area redirects to /assessment.
// Blocking help/support outright would leave someone who genuinely cannot
// complete the assessment with no way to say so.
const LOCKED_ALLOWED_PREFIXES = [
  '/assessment',
  '/support',
  '/help',
  '/profile',
  '/settings',
  '/notifications',
  '/logout',
];

/** True when a locked mentee is allowed to view `pathname`. */
export function isAllowedWhileLocked(pathname: string): boolean {
  return LOCKED_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
