import { addDays, addMonths } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────────
// Quarterly assessment cadence (pure — no I/O, fully unit tested).
//
// The programme runs a mandatory mentee assessment every N months (default 3)
// counted from the cohort's start date, so everyone in a cohort assesses on the
// same dates. This module turns a cohort's dates into the list of windows to
// create; the admin can then edit any window (move a due date, deactivate one)
// without re-running the planner.
// ──────────────────────────────────────────────────────────────────────────

/** How long before its due date a window starts accepting submissions. */
export const DEFAULT_OPEN_LEAD_DAYS = 14;

/** Safety cap so a cohort with no end date can't generate windows forever. */
export const MAX_PLANNED_WINDOWS = 12;

export interface AssessmentWindowPlan {
  /** 1-based occurrence: 1 is the first assessment, at start + intervalMonths. */
  sequence: number;
  /** Month offset from the cohort start that this assessment covers up to. */
  monthOffset: number;
  opensAt: Date;
  dueAt: Date;
}

export interface PlanAssessmentWindowsInput {
  startDate: Date;
  /** Cohort end date. When absent, `fallbackWindows` windows are planned. */
  endDate?: Date | null;
  /** Months between assessments. Values < 1 are treated as 1. */
  intervalMonths: number;
  openLeadDays?: number;
  /** Windows to plan when the cohort has no end date. */
  fallbackWindows?: number;
}

/**
 * The windows a cohort should have. A window is planned for every whole
 * interval that fits inside the cohort's run: a 9-month cohort on a 3-month
 * interval gets assessments due at months 3, 6 and 9.
 *
 * The final assessment lands exactly on the end date rather than being skipped —
 * that last one is the end-of-programme checkpoint.
 */
export function planAssessmentWindows(input: PlanAssessmentWindowsInput): AssessmentWindowPlan[] {
  const interval = Math.max(1, Math.floor(input.intervalMonths));
  const leadDays = input.openLeadDays ?? DEFAULT_OPEN_LEAD_DAYS;
  const plans: AssessmentWindowPlan[] = [];

  // With no end date we can't know the programme length, so plan a fixed
  // number of windows (a year's worth by default) and let the admin trim.
  const limit = input.endDate
    ? MAX_PLANNED_WINDOWS
    : Math.min(input.fallbackWindows ?? Math.ceil(12 / interval), MAX_PLANNED_WINDOWS);

  for (let sequence = 1; sequence <= limit; sequence += 1) {
    const monthOffset = sequence * interval;
    const dueAt = addMonths(input.startDate, monthOffset);

    // Stop once an assessment would fall after the cohort ends. Equality is
    // kept: an assessment due exactly on the end date is the final checkpoint.
    if (input.endDate && dueAt.getTime() > input.endDate.getTime()) break;

    plans.push({
      sequence,
      monthOffset,
      opensAt: addDays(dueAt, -leadDays),
      dueAt,
    });
  }

  return plans;
}

/** Default admin-facing label for a planned window, e.g. "Month 3 assessment". */
export function defaultWindowLabel(plan: AssessmentWindowPlan): string {
  return `Month ${plan.monthOffset} assessment`;
}

// ──────────────────────────────────────────────────────────────────────────
// Monthly meeting form cadence
//
// Different anchor from the quarterly assessment on purpose: this one runs on
// CALENDAR months, so "this month's form" means the same thing to everyone
// regardless of when their cohort started. Each window opens on the 1st and is
// due on the last day of that month.
// ──────────────────────────────────────────────────────────────────────────

export interface MonthlyWindowPlan {
  sequence: number;
  /** First day of the month, 00:00 UTC. */
  opensAt: Date;
  /** Last day of the month, 23:59:59.999 UTC. */
  dueAt: Date;
  /** 0-indexed month, as Date.getUTCMonth(). */
  month: number;
  year: number;
}

export interface PlanMonthlyWindowsInput {
  /** Cohort start; the first form covers the month this falls in. */
  startDate: Date;
  /** Cohort end; the last form covers the month this falls in. */
  endDate?: Date | null;
  /** Months to plan when the cohort has no end date. */
  fallbackMonths?: number;
}

/** Safety cap for a cohort with no end date. */
export const MAX_PLANNED_MONTHS = 24;

/**
 * One window per calendar month the cohort runs in, inclusive of both the
 * starting and ending month — a cohort running 15 Jan to 30 Sep gets nine
 * forms, January through September.
 *
 * Built from UTC month arithmetic rather than `addMonths` so a month-end start
 * date cannot skew the sequence (31 Jan + 1 month is not 28 Feb here; the
 * planner walks months, not days).
 */
export function planMonthlyWindows(input: PlanMonthlyWindowsInput): MonthlyWindowPlan[] {
  const startYear = input.startDate.getUTCFullYear();
  const startMonth = input.startDate.getUTCMonth();

  const monthCount = input.endDate
    ? (input.endDate.getUTCFullYear() - startYear) * 12 +
      (input.endDate.getUTCMonth() - startMonth) +
      1
    : (input.fallbackMonths ?? 12);

  const limit = Math.min(Math.max(0, monthCount), MAX_PLANNED_MONTHS);
  const plans: MonthlyWindowPlan[] = [];

  for (let index = 0; index < limit; index += 1) {
    // Month overflow is handled by Date.UTC itself: month 12 rolls to January.
    const opensAt = new Date(Date.UTC(startYear, startMonth + index, 1, 0, 0, 0, 0));
    // Day 0 of the NEXT month is the last day of this one, so this is correct
    // for 28/29/30/31-day months without a leap-year special case.
    const dueAt = new Date(Date.UTC(startYear, startMonth + index + 1, 0, 23, 59, 59, 999));

    plans.push({
      sequence: index + 1,
      opensAt,
      dueAt,
      month: opensAt.getUTCMonth(),
      year: opensAt.getUTCFullYear(),
    });
  }

  return plans;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Admin-facing label, e.g. "March 2026 meeting form". */
export function defaultMonthlyWindowLabel(plan: MonthlyWindowPlan): string {
  return `${MONTH_NAMES[plan.month]} ${plan.year} meeting form`;
}
