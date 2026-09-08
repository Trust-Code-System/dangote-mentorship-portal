import { describe, expect, it } from 'vitest';
import {
  isWeeklyReportDue,
  isoWeekKey,
  isoWeekday,
  startOfIsoWeek,
} from '@/features/reports/weekly';

// The scheduler runs daily, so "weekly" has to be enforced by the week key.
// ISO week arithmetic is the classic place this goes wrong — 1 January is
// frequently week 52 or 53 of the *previous* year — so the year boundaries get
// explicit coverage.

describe('isoWeekday', () => {
  it('maps Monday to 1 and Sunday to 7', () => {
    expect(isoWeekday(new Date('2026-09-07T00:00:00Z'))).toBe(1); // Monday
    expect(isoWeekday(new Date('2026-09-13T00:00:00Z'))).toBe(7); // Sunday
  });
});

describe('isoWeekKey', () => {
  it('is stable across every day of one ISO week', () => {
    const keys = [
      '2026-09-07', // Mon
      '2026-09-08',
      '2026-09-10',
      '2026-09-13', // Sun
    ].map((d) => isoWeekKey(new Date(`${d}T12:00:00Z`)));
    expect(new Set(keys).size).toBe(1);
  });

  it('rolls over on Monday, not Sunday', () => {
    const sunday = isoWeekKey(new Date('2026-09-13T23:59:00Z'));
    const monday = isoWeekKey(new Date('2026-09-14T00:01:00Z'));
    expect(sunday).not.toBe(monday);
  });

  it('formats as yyyy-Www with a padded week number', () => {
    expect(isoWeekKey(new Date('2026-01-05T00:00:00Z'))).toBe('2026-W02');
  });

  // 2027-01-01 is a Friday, so it belongs to ISO week 53 of 2026.
  it('assigns a January date to the previous ISO week-year when ISO says so', () => {
    expect(isoWeekKey(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
  });

  // 2029-12-31 is a Monday, which starts ISO week 1 of 2030.
  it('assigns a December date to the next ISO week-year when ISO says so', () => {
    expect(isoWeekKey(new Date('2029-12-31T00:00:00Z'))).toBe('2030-W01');
  });

  it('is unaffected by the time of day', () => {
    expect(isoWeekKey(new Date('2026-09-07T00:00:00Z'))).toBe(
      isoWeekKey(new Date('2026-09-07T23:59:59Z')),
    );
  });
});

describe('startOfIsoWeek', () => {
  it('returns the Monday of that week at midnight UTC', () => {
    expect(startOfIsoWeek(new Date('2026-09-10T15:30:00Z')).toISOString()).toBe(
      '2026-09-07T00:00:00.000Z',
    );
  });

  it('is a no-op on a Monday morning', () => {
    expect(startOfIsoWeek(new Date('2026-09-07T00:00:00Z')).toISOString()).toBe(
      '2026-09-07T00:00:00.000Z',
    );
  });

  it('goes back to the previous Monday on a Sunday', () => {
    expect(startOfIsoWeek(new Date('2026-09-13T12:00:00Z')).toISOString()).toBe(
      '2026-09-07T00:00:00.000Z',
    );
  });
});

describe('isWeeklyReportDue', () => {
  const monday = new Date('2026-09-07T06:00:00Z');
  const wednesday = new Date('2026-09-09T06:00:00Z');
  const sunday = new Date('2026-09-13T06:00:00Z');

  it('is due on the chosen weekday when no report exists', () => {
    expect(isWeeklyReportDue({ now: monday, lastGeneratedWeek: null })).toBe(true);
  });

  it('is not due again once this week has a report', () => {
    expect(isWeeklyReportDue({ now: wednesday, lastGeneratedWeek: '2026-W37' })).toBe(false);
  });

  it('is due again the following week', () => {
    expect(
      isWeeklyReportDue({ now: new Date('2026-09-14T06:00:00Z'), lastGeneratedWeek: '2026-W37' }),
    ).toBe(true);
  });

  // Catch-up: a missed Monday must not lose the week.
  it('still generates later in the week if the weekday run was missed', () => {
    expect(isWeeklyReportDue({ now: sunday, lastGeneratedWeek: '2026-W36' })).toBe(true);
  });

  it('is not due before the chosen weekday arrives', () => {
    // Ask for Wednesday; Monday is too early.
    expect(isWeeklyReportDue({ now: monday, lastGeneratedWeek: null, weekday: 3 })).toBe(false);
  });

  it('is due on the chosen weekday when it is later in the week', () => {
    expect(isWeeklyReportDue({ now: wednesday, lastGeneratedWeek: null, weekday: 3 })).toBe(true);
  });

  it('generates only once even when run every day of the week', () => {
    let lastWeek: string | null = null;
    let generated = 0;
    for (const day of [7, 8, 9, 10, 11, 12, 13]) {
      const now = new Date(`2026-09-${String(day).padStart(2, '0')}T06:00:00Z`);
      if (isWeeklyReportDue({ now, lastGeneratedWeek: lastWeek })) {
        generated += 1;
        lastWeek = isoWeekKey(now);
      }
    }
    expect(generated).toBe(1);
  });
});
