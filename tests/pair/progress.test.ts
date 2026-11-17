import { describe, expect, it } from 'vitest';
import { pairProgress } from '@/features/pair/progress';
import type { PairWorkspace } from '@/features/pair/data';

function fixture(): PairWorkspace {
  const person = {
    id: 'person',
    name: 'Test',
    language: null,
    department: null,
    jobTitle: null,
    phone: null,
    availability: null,
  };
  return {
    role: 'mentee',
    cohortId: 'cohort',
    cohortName: 'Current stream',
    mentor: person,
    mentee: person,
    agreements: ['MENTORING', 'CONFIDENTIALITY'].map((type) => ({
      type: type as 'MENTORING' | 'CONFIDENTIALITY',
      mentorSignedAt: null,
      menteeSignedAt: null,
    })),
    goals: [],
    nextMeeting: null,
    meetingCount: 0,
    sessionCount: 0,
    lastSessionAt: null,
    totalActionCount: 0,
    openActionItems: [],
    certificateEarned: false,
    latestSession: null,
  };
}

describe('saved partnership milestones', () => {
  it('starts at zero and does not invent completed agreements or goals', () => {
    const result = pairProgress(fixture());
    expect(result.progressPercent).toBe(0);
    expect(result.current?.key).toBe('agreement');
    expect(result.topGoalPercent).toBe(0);
  });
  it('requires both signatures on both agreements', () => {
    const pair = fixture();
    pair.agreements.forEach((agreement) => {
      agreement.mentorSignedAt = new Date();
    });
    expect(pairProgress(pair).steps[0]?.completed).toBe(false);
    pair.agreements.forEach((agreement) => {
      agreement.menteeSignedAt = new Date();
    });
    expect(pairProgress(pair).progressPercent).toBe(20);
    expect(pairProgress(pair).current?.key).toBe('goals');
  });
  it('tracks mentor approval and actual goal stages instead of a fixed bar', () => {
    const pair = fixture();
    pair.goals = [
      { id: 'goal', title: 'Leadership', status: 'SUBMITTED', stage: 'MENTOR_REVIEWED' },
    ];
    expect(pairProgress(pair).topGoalPercent).toBe(20);
    expect(pairProgress(pair).steps[2]?.completed).toBe(false);
    pair.goals[0] = { ...pair.goals[0]!, status: 'APPROVED', stage: 'IN_PROGRESS' };
    expect(pairProgress(pair).topGoalPercent).toBe(60);
    expect(pairProgress(pair).steps[2]?.completed).toBe(true);
  });
  it('does not count an empty action list or unreleased certificate as complete', () => {
    const pair = fixture();
    expect(pairProgress(pair).steps[3]?.completed).toBe(false);
    pair.sessionCount = 1;
    pair.totalActionCount = 1;
    pair.openActionItems = [
      {
        id: 'item',
        title: 'Follow up',
        dueDate: null,
        status: 'OPEN',
        assigneeName: null,
        overdue: false,
      },
    ];
    expect(pairProgress(pair).steps[3]?.completed).toBe(false);
    pair.openActionItems = [];
    expect(pairProgress(pair).steps[3]?.completed).toBe(true);
    expect(pairProgress(pair).steps[4]?.completed).toBe(false);
    pair.certificateEarned = true;
    expect(pairProgress(pair).steps[4]?.completed).toBe(true);
  });
});
