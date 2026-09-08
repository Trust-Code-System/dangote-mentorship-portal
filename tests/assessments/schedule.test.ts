import { describe, expect, it } from 'vitest';
import {
  MAX_PLANNED_WINDOWS,
  defaultWindowLabel,
  planAssessmentWindows,
} from '@/features/assessments/schedule';

describe('planAssessmentWindows', () => {
  const startDate = new Date('2026-01-01T00:00:00Z');

  it('plans an assessment every 3 months across a 9-month cohort', () => {
    const plans = planAssessmentWindows({
      startDate,
      endDate: new Date('2026-10-01T00:00:00Z'),
      intervalMonths: 3,
    });

    expect(plans.map((p) => p.monthOffset)).toEqual([3, 6, 9]);
    expect(plans.map((p) => p.sequence)).toEqual([1, 2, 3]);
    expect(plans[0]?.dueAt).toEqual(new Date('2026-04-01T00:00:00Z'));
    expect(plans[2]?.dueAt).toEqual(new Date('2026-10-01T00:00:00Z'));
  });

  it('opens each window 14 days before it is due by default', () => {
    const [first] = planAssessmentWindows({
      startDate,
      endDate: new Date('2026-10-01T00:00:00Z'),
      intervalMonths: 3,
    });
    expect(first?.opensAt).toEqual(new Date('2026-03-18T00:00:00Z'));
  });

  it('honours a custom open lead time', () => {
    const [first] = planAssessmentWindows({
      startDate,
      endDate: new Date('2026-10-01T00:00:00Z'),
      intervalMonths: 3,
      openLeadDays: 30,
    });
    expect(first?.opensAt).toEqual(new Date('2026-03-02T00:00:00Z'));
  });

  it('keeps a final assessment that lands exactly on the end date', () => {
    const plans = planAssessmentWindows({
      startDate,
      endDate: new Date('2026-07-01T00:00:00Z'),
      intervalMonths: 3,
    });
    expect(plans).toHaveLength(2);
    expect(plans[1]?.dueAt).toEqual(new Date('2026-07-01T00:00:00Z'));
  });

  it('drops an assessment that would fall after the cohort ends', () => {
    const plans = planAssessmentWindows({
      startDate,
      endDate: new Date('2026-08-31T00:00:00Z'),
      intervalMonths: 3,
    });
    expect(plans.map((p) => p.monthOffset)).toEqual([3, 6]);
  });

  it('plans nothing for a cohort shorter than one interval', () => {
    const plans = planAssessmentWindows({
      startDate,
      endDate: new Date('2026-02-15T00:00:00Z'),
      intervalMonths: 3,
    });
    expect(plans).toEqual([]);
  });

  it('falls back to a year of windows when the cohort has no end date', () => {
    const plans = planAssessmentWindows({ startDate, endDate: null, intervalMonths: 3 });
    expect(plans.map((p) => p.monthOffset)).toEqual([3, 6, 9, 12]);
  });

  it('respects an explicit fallback count with no end date', () => {
    const plans = planAssessmentWindows({
      startDate,
      endDate: null,
      intervalMonths: 3,
      fallbackWindows: 2,
    });
    expect(plans).toHaveLength(2);
  });

  it('never exceeds the safety cap', () => {
    const plans = planAssessmentWindows({
      startDate,
      endDate: new Date('2040-01-01T00:00:00Z'),
      intervalMonths: 1,
    });
    expect(plans).toHaveLength(MAX_PLANNED_WINDOWS);
  });

  it('treats a zero or negative interval as monthly rather than looping forever', () => {
    const plans = planAssessmentWindows({
      startDate,
      endDate: new Date('2026-04-01T00:00:00Z'),
      intervalMonths: 0,
    });
    expect(plans.map((p) => p.monthOffset)).toEqual([1, 2, 3]);
  });

  it('clamps month arithmetic at month ends rather than overflowing', () => {
    // 30 Nov + 3 months = 28 Feb (not 2 March).
    const plans = planAssessmentWindows({
      startDate: new Date('2025-11-30T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
      intervalMonths: 3,
    });
    expect(plans[0]?.dueAt).toEqual(new Date('2026-02-28T00:00:00Z'));
  });
});

describe('defaultWindowLabel', () => {
  it('names a window by its month offset', () => {
    expect(
      defaultWindowLabel({
        sequence: 2,
        monthOffset: 6,
        opensAt: new Date(),
        dueAt: new Date(),
      }),
    ).toBe('Month 6 assessment');
  });
});
