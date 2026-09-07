import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENGAGEMENT_THRESHOLDS,
  assessEngagement,
  compareByConcern,
  daysBetween,
  lastActiveFrom,
  lastSignalFrom,
  needsAttention,
  summarizeEngagement,
  type EngagementState,
} from '@/features/engagement/activity';

// This decides who appears on the admin's "not been active" list and in the
// weekly report. Both false positives (chasing someone who just joined) and
// false negatives (missing someone who vanished) are real failures, so the
// boundaries get explicit coverage.

const NOW = new Date('2026-09-07T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('daysBetween', () => {
  it('floors to whole days', () => {
    expect(daysBetween(new Date('2026-09-05T23:00:00Z'), NOW)).toBe(1);
  });

  it('is zero for the same instant', () => {
    expect(daysBetween(NOW, NOW)).toBe(0);
  });

  it('never returns a negative for a future date', () => {
    expect(daysBetween(new Date('2026-10-01T00:00:00Z'), NOW)).toBe(0);
  });
});

describe('lastActiveFrom', () => {
  it('picks the most recent signal', () => {
    expect(
      lastActiveFrom({ session: daysAgo(30), goal: daysAgo(2), message: daysAgo(9) }),
    ).toEqual(daysAgo(2));
  });

  it('ignores null and missing signals', () => {
    expect(lastActiveFrom({ session: null, goal: daysAgo(5) })).toEqual(daysAgo(5));
  });

  it('returns null when nothing has ever happened', () => {
    expect(lastActiveFrom({})).toBeNull();
    expect(lastActiveFrom({ session: null, message: null })).toBeNull();
  });
});

describe('lastSignalFrom', () => {
  it('names which signal was most recent', () => {
    expect(lastSignalFrom({ session: daysAgo(30), goal: daysAgo(2) })).toBe('goal');
  });

  it('returns null when nothing has happened', () => {
    expect(lastSignalFrom({})).toBeNull();
  });
});

describe('assessEngagement', () => {
  const joinedLongAgo = daysAgo(120);

  it('is active for recent activity', () => {
    const result = assessEngagement(
      { joinedAt: joinedLongAgo, signals: { session: daysAgo(3) } },
      NOW,
    );
    expect(result.state).toBe('active');
    expect(result.daysSinceActive).toBe(3);
    expect(result.lastSignal).toBe('session');
  });

  it('is quiet at exactly the quiet threshold', () => {
    const result = assessEngagement(
      { joinedAt: joinedLongAgo, signals: { goal: daysAgo(DEFAULT_ENGAGEMENT_THRESHOLDS.quietAfterDays) } },
      NOW,
    );
    expect(result.state).toBe('quiet');
  });

  it('is still active one day short of quiet', () => {
    const result = assessEngagement(
      {
        joinedAt: joinedLongAgo,
        signals: { goal: daysAgo(DEFAULT_ENGAGEMENT_THRESHOLDS.quietAfterDays - 1) },
      },
      NOW,
    );
    expect(result.state).toBe('active');
  });

  it('is inactive at exactly the inactive threshold', () => {
    const result = assessEngagement(
      {
        joinedAt: joinedLongAgo,
        signals: { session: daysAgo(DEFAULT_ENGAGEMENT_THRESHOLDS.inactiveAfterDays) },
      },
      NOW,
    );
    expect(result.state).toBe('inactive');
  });

  it('is "never" for someone long enrolled who has done nothing', () => {
    const result = assessEngagement({ joinedAt: joinedLongAgo, signals: {} }, NOW);
    expect(result.state).toBe('never');
    expect(result.daysSinceActive).toBeNull();
    expect(result.lastActiveAt).toBeNull();
  });

  // The grace period is the anti-false-positive rule: a fresh intake must not
  // light up the report on day one.
  it('does not flag a brand-new joiner who has done nothing yet', () => {
    const result = assessEngagement({ joinedAt: daysAgo(2), signals: {} }, NOW);
    expect(result.state).toBe('active');
  });

  it('starts judging a joiner once the grace period has elapsed', () => {
    const result = assessEngagement(
      { joinedAt: daysAgo(DEFAULT_ENGAGEMENT_THRESHOLDS.newJoinerGraceDays), signals: {} },
      NOW,
    );
    expect(result.state).toBe('never');
  });

  it('grace also protects a new joiner who acted once then paused', () => {
    const result = assessEngagement(
      { joinedAt: daysAgo(5), signals: { goal: daysAgo(5) } },
      NOW,
    );
    expect(result.state).toBe('active');
  });

  it('judges on the MOST RECENT signal, not the oldest', () => {
    // Nothing for 60 days except a message yesterday — that person is active.
    const result = assessEngagement(
      { joinedAt: joinedLongAgo, signals: { session: daysAgo(60), message: daysAgo(1) } },
      NOW,
    );
    expect(result.state).toBe('active');
    expect(result.lastSignal).toBe('message');
  });

  it('honours custom thresholds', () => {
    const strict = { quietAfterDays: 3, inactiveAfterDays: 5, newJoinerGraceDays: 1 };
    const result = assessEngagement(
      { joinedAt: joinedLongAgo, signals: { session: daysAgo(6) } },
      NOW,
      strict,
    );
    expect(result.state).toBe('inactive');
  });

  it('reports days since joining alongside days since active', () => {
    const result = assessEngagement(
      { joinedAt: daysAgo(40), signals: { session: daysAgo(12) } },
      NOW,
    );
    expect(result.daysSinceJoined).toBe(40);
    expect(result.daysSinceActive).toBe(12);
  });
});

describe('needsAttention', () => {
  it('is true only for inactive and never', () => {
    expect(needsAttention('inactive')).toBe(true);
    expect(needsAttention('never')).toBe(true);
    expect(needsAttention('quiet')).toBe(false);
    expect(needsAttention('active')).toBe(false);
  });
});

describe('summarizeEngagement', () => {
  it('counts each state and the attention total', () => {
    const states: EngagementState[] = ['active', 'active', 'quiet', 'inactive', 'never', 'never'];
    expect(summarizeEngagement(states)).toEqual({
      total: 6,
      active: 2,
      quiet: 1,
      inactive: 1,
      never: 2,
      needsAttention: 3,
    });
  });

  it('handles an empty cohort without dividing by anything', () => {
    expect(summarizeEngagement([])).toEqual({
      total: 0,
      active: 0,
      quiet: 0,
      inactive: 0,
      never: 0,
      needsAttention: 0,
    });
  });
});

describe('compareByConcern', () => {
  it('puts never-active ahead of merely inactive', () => {
    const order = [
      { state: 'active' as const, daysSinceActive: 1 },
      { state: 'inactive' as const, daysSinceActive: 30 },
      { state: 'never' as const, daysSinceActive: null },
      { state: 'quiet' as const, daysSinceActive: 12 },
    ].sort(compareByConcern);
    expect(order.map((o) => o.state)).toEqual(['never', 'inactive', 'quiet', 'active']);
  });

  it('within a state, the longest silence comes first', () => {
    const order = [
      { state: 'inactive' as const, daysSinceActive: 25 },
      { state: 'inactive' as const, daysSinceActive: 60 },
      { state: 'inactive' as const, daysSinceActive: 40 },
    ].sort(compareByConcern);
    expect(order.map((o) => o.daysSinceActive)).toEqual([60, 40, 25]);
  });
});
