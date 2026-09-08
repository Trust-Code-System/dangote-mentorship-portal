import { describe, expect, it } from 'vitest';
import {
  MAX_PLANNED_MONTHS,
  defaultMonthlyWindowLabel,
  planMonthlyWindows,
} from '@/features/assessments/schedule';

// The monthly meeting form runs on CALENDAR months, unlike the quarterly
// assessment which is anchored to the cohort start. Month-boundary arithmetic is
// where this kind of code goes wrong, so the boundaries are pinned down here.

const iso = (d: Date) => d.toISOString();

describe('planMonthlyWindows', () => {
  it('plans one window per calendar month, inclusive of first and last', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-01-15T00:00:00Z'),
      endDate: new Date('2026-09-30T00:00:00Z'),
    });
    expect(plans).toHaveLength(9);
    expect(plans[0]?.month).toBe(0); // January
    expect(plans[8]?.month).toBe(8); // September
  });

  it('opens on the first of the month and is due at the end of the last day', () => {
    const [january] = planMonthlyWindows({
      startDate: new Date('2026-01-15T00:00:00Z'),
      endDate: new Date('2026-01-31T00:00:00Z'),
    });
    expect(iso(january!.opensAt)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(january!.dueAt)).toBe('2026-01-31T23:59:59.999Z');
  });

  it('covers the month the cohort starts in, even starting mid-month', () => {
    const [first] = planMonthlyWindows({
      startDate: new Date('2026-03-28T00:00:00Z'),
      endDate: new Date('2026-04-30T00:00:00Z'),
    });
    // The March form still exists; it is not skipped for a late start.
    expect(first?.month).toBe(2);
    expect(iso(first!.opensAt)).toBe('2026-03-01T00:00:00.000Z');
  });

  it('gets February right in a non-leap year', () => {
    const [february] = planMonthlyWindows({
      startDate: new Date('2026-02-10T00:00:00Z'),
      endDate: new Date('2026-02-20T00:00:00Z'),
    });
    expect(iso(february!.dueAt)).toBe('2026-02-28T23:59:59.999Z');
  });

  it('gets February right in a leap year', () => {
    const [february] = planMonthlyWindows({
      startDate: new Date('2028-02-10T00:00:00Z'),
      endDate: new Date('2028-02-20T00:00:00Z'),
    });
    expect(iso(february!.dueAt)).toBe('2028-02-29T23:59:59.999Z');
  });

  it('handles a 30-day month', () => {
    const [april] = planMonthlyWindows({
      startDate: new Date('2026-04-05T00:00:00Z'),
      endDate: new Date('2026-04-06T00:00:00Z'),
    });
    expect(iso(april!.dueAt)).toBe('2026-04-30T23:59:59.999Z');
  });

  it('rolls across a year boundary', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-11-10T00:00:00Z'),
      endDate: new Date('2027-02-05T00:00:00Z'),
    });
    expect(plans).toHaveLength(4);
    expect(plans.map((p) => `${p.year}-${p.month}`)).toEqual([
      '2026-10',
      '2026-11',
      '2027-0',
      '2027-1',
    ]);
    expect(iso(plans[3]!.dueAt)).toBe('2027-02-28T23:59:59.999Z');
  });

  it('numbers sequences from 1 without gaps', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
    });
    expect(plans.map((p) => p.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('plans a single window when the cohort runs inside one month', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-05-02T00:00:00Z'),
      endDate: new Date('2026-05-28T00:00:00Z'),
    });
    expect(plans).toHaveLength(1);
  });

  it('plans a year when the cohort has no end date', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-01-15T00:00:00Z'),
      endDate: null,
    });
    expect(plans).toHaveLength(12);
  });

  it('respects an explicit fallback month count', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-01-15T00:00:00Z'),
      endDate: null,
      fallbackMonths: 3,
    });
    expect(plans).toHaveLength(3);
  });

  it('never exceeds the safety cap', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2040-01-01T00:00:00Z'),
    });
    expect(plans).toHaveLength(MAX_PLANNED_MONTHS);
  });

  it('plans nothing when the end date precedes the start month', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-05-01T00:00:00Z'),
      endDate: new Date('2026-03-01T00:00:00Z'),
    });
    expect(plans).toEqual([]);
  });

  it('produces windows that never overlap and leave no gap', () => {
    const plans = planMonthlyWindows({
      startDate: new Date('2026-01-15T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    });
    for (let i = 1; i < plans.length; i += 1) {
      // Each window opens exactly 1ms after the previous one was due.
      expect(plans[i]!.opensAt.getTime() - plans[i - 1]!.dueAt.getTime()).toBe(1);
    }
  });
});

describe('defaultMonthlyWindowLabel', () => {
  it('names the window by its month and year', () => {
    const [march] = planMonthlyWindows({
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    });
    expect(defaultMonthlyWindowLabel(march!)).toBe('March 2026 meeting form');
  });

  it('names December correctly (last month index)', () => {
    const [december] = planMonthlyWindows({
      startDate: new Date('2026-12-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    });
    expect(defaultMonthlyWindowLabel(december!)).toBe('December 2026 meeting form');
  });
});
