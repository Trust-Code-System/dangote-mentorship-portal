import { describe, expect, it } from 'vitest';
import {
  computeJourney,
  JOURNEY_STEPS,
  type JourneyFacts,
  type JourneyRole,
  type JourneyStepKey,
  type JourneyState,
} from '@/features/journey/journey';

const NOW = new Date('2026-06-10T00:00:00Z');
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function facts(overrides: Partial<JourneyFacts> = {}): JourneyFacts {
  return {
    role: 'mentee' as JourneyRole,
    profileComplete: false,
    trainingCompleted: false,
    trainingInProgress: false,
    matched: false,
    matchedAt: null,
    confidentialitySigned: false,
    goalsSubmitted: false,
    goalsApproved: false,
    sessionCount: 0,
    lastSessionAt: null,
    midtermDone: false,
    finalDone: false,
    now: NOW,
    ...overrides,
  };
}

function stateOf(f: JourneyFacts, key: JourneyStepKey): JourneyState {
  return computeJourney(f).steps.find((s) => s.key === key)!.state;
}

describe('computeJourney — shape', () => {
  it('returns all nine steps in order', () => {
    const result = computeJourney(facts());
    expect(result.steps.map((s) => s.key)).toEqual([...JOURNEY_STEPS]);
  });

  it('a brand-new mentee is pointed at their profile first', () => {
    const result = computeJourney(facts());
    expect(stateOf(facts(), 'profile')).toBe('needs_action');
    expect(result.currentStepKey).toBe('profile');
    expect(result.progressPercent).toBe(0);
  });
});

describe('profile + training gating', () => {
  it('training waits until the profile is complete', () => {
    expect(stateOf(facts(), 'training')).toBe('pending');
    expect(stateOf(facts({ profileComplete: true }), 'training')).toBe('needs_action');
  });

  it('training is completed once recorded complete', () => {
    expect(stateOf(facts({ profileComplete: true, trainingCompleted: true }), 'training')).toBe(
      'completed',
    );
  });
});

describe('matching is admin-driven, never needs_action', () => {
  it('stays pending until matched, then completed', () => {
    expect(stateOf(facts({ profileComplete: true, trainingCompleted: true }), 'matched')).toBe(
      'pending',
    );
    expect(stateOf(facts({ matched: true }), 'matched')).toBe('completed');
  });
});

describe('confidentiality agreement', () => {
  const base = { profileComplete: true, trainingCompleted: true, matched: true };
  it('is pending before matching', () => {
    expect(stateOf(facts(), 'confidentiality')).toBe('pending');
  });
  it('needs action once matched and recently', () => {
    expect(stateOf(facts({ ...base, matchedAt: daysAgo(3) }), 'confidentiality')).toBe(
      'needs_action',
    );
  });
  it('goes overdue when unsigned past the soft deadline', () => {
    expect(stateOf(facts({ ...base, matchedAt: daysAgo(20) }), 'confidentiality')).toBe('overdue');
  });
  it('is completed once signed', () => {
    expect(stateOf(facts({ ...base, confidentialitySigned: true }), 'confidentiality')).toBe(
      'completed',
    );
  });
});

describe('goals — mentee vs mentor', () => {
  const signed = { profileComplete: true, matched: true, confidentialitySigned: true };
  it('mentee: needs action after signing, completed once submitted', () => {
    expect(stateOf(facts({ ...signed, matchedAt: daysAgo(5) }), 'goals')).toBe('needs_action');
    expect(stateOf(facts({ ...signed, goalsSubmitted: true }), 'goals')).toBe('completed');
  });
  it('mentee: overdue when no goals long after matching', () => {
    expect(stateOf(facts({ ...signed, matchedAt: daysAgo(40) }), 'goals')).toBe('overdue');
  });
  it('mentor: a submitted-but-unapproved goal needs review', () => {
    expect(stateOf(facts({ role: 'mentor', matched: true, goalsSubmitted: true }), 'goals')).toBe(
      'needs_action',
    );
    expect(
      stateOf(
        facts({ role: 'mentor', matched: true, goalsSubmitted: true, goalsApproved: true }),
        'goals',
      ),
    ).toBe('completed');
  });
});

describe('monthly sessions', () => {
  const ready = { matched: true, matchedAt: daysAgo(10) };
  it('needs the first session once matched', () => {
    expect(stateOf(facts(ready), 'sessions')).toBe('needs_action');
  });
  it('does not report an undated log as a recent monthly session', () => {
    expect(stateOf(facts({ ...ready, sessionCount: 1, lastSessionAt: null }), 'sessions')).toBe(
      'needs_action',
    );
  });
  it('is overdue with no session long after matching', () => {
    expect(stateOf(facts({ matched: true, matchedAt: daysAgo(45) }), 'sessions')).toBe('overdue');
  });
  it('is on track right after a recent session', () => {
    expect(
      stateOf(facts({ ...ready, sessionCount: 2, lastSessionAt: daysAgo(10) }), 'sessions'),
    ).toBe('completed');
  });
  it('is due again after a month, overdue after two', () => {
    expect(
      stateOf(facts({ ...ready, sessionCount: 2, lastSessionAt: daysAgo(40) }), 'sessions'),
    ).toBe('needs_action');
    expect(
      stateOf(facts({ ...ready, sessionCount: 2, lastSessionAt: daysAgo(70) }), 'sessions'),
    ).toBe('overdue');
  });
});

describe('completion certificate', () => {
  it('keeps completed mentees pending until explicit certificate permission', () => {
    const done = facts({
      trainingCompleted: true,
      goalsApproved: true,
      midtermDone: true,
      finalDone: true,
    });
    expect(stateOf(done, 'completion')).toBe('pending');
    expect(stateOf({ ...done, certificateApproved: true }, 'completion')).toBe('completed');
  });
  it('is earned only when training, goals, and both reviews are done', () => {
    const done = facts({
      profileComplete: true,
      trainingCompleted: true,
      matched: true,
      confidentialitySigned: true,
      goalsSubmitted: true,
      goalsApproved: true,
      sessionCount: 6,
      lastSessionAt: daysAgo(5),
      midtermDone: true,
      finalDone: true,
      certificateApproved: true,
    });
    const result = computeJourney(done);
    expect(stateOf(done, 'completion')).toBe('completed');
    expect(result.progressPercent).toBe(100);
    expect(result.currentStepKey).toBeNull();
  });
});
