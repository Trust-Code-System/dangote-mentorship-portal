// ──────────────────────────────────────────────────────────────────────────
// Weekly engagement report scheduling (pure — no I/O, unit tested).
//
// The scheduler runs daily (Vercel's Hobby plan permits nothing more frequent),
// so "weekly" is expressed as *one report per ISO week*, generated on or after
// a chosen weekday. Two consequences that matter:
//
//   - it is idempotent: a second run in the same ISO week does nothing;
//   - it catches up: if the cron misses Monday, Tuesday's run still produces
//     that week's report rather than skipping the week entirely.
// ──────────────────────────────────────────────────────────────────────────

/** ISO weekday the report is generated on or after. 1 = Monday. */
export const WEEKLY_REPORT_WEEKDAY = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * ISO-8601 week key, e.g. `2026-W37`.
 *
 * ISO weeks start on Monday and belong to the year containing their Thursday,
 * which is why this cannot be done with getMonth()/getDate(): 1 January can
 * legitimately be week 52 of the previous year.
 */
export function isoWeekKey(date: Date): string {
  // Work on a UTC copy shifted to the Thursday of this ISO week; that Thursday's
  // calendar year is by definition the ISO week-year.
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const isoDay = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
  target.setUTCDate(target.getUTCDate() + 4 - isoDay);

  const weekYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstIsoDay = firstThursday.getUTCDay() === 0 ? 7 : firstThursday.getUTCDay();
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstIsoDay);

  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

/** ISO weekday (1 = Monday … 7 = Sunday) in UTC. */
export function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Monday 00:00:00.000 UTC of the ISO week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (isoWeekday(start) - 1));
  return start;
}

export interface WeeklyDueInput {
  now: Date;
  /** ISO week key of the most recent report, or null if none exists. */
  lastGeneratedWeek: string | null;
  weekday?: number;
}

/**
 * Should this week's report be generated now?
 *
 * True only when the chosen weekday has arrived in the current ISO week and no
 * report exists for that week yet.
 */
export function isWeeklyReportDue(input: WeeklyDueInput): boolean {
  const weekday = input.weekday ?? WEEKLY_REPORT_WEEKDAY;
  if (isoWeekday(input.now) < weekday) return false;
  return isoWeekKey(input.now) !== input.lastGeneratedWeek;
}
