import { describe, expect, it } from 'vitest';
import {
  evaluateAssessmentGate,
  isAllowedWhileLocked,
  lockDateFor,
  type GateWindow,
} from '@/features/assessments/gate';

// The gate decides whether a mentee keeps access to the portal, so it gets full
// unit coverage (CLAUDE.md §0 rule 4 spirit: gating logic is non-negotiable).

const DAY = 24 * 60 * 60 * 1000;

function windowAt(overrides: Partial<GateWindow> = {}): GateWindow {
  return {
    id: 'w1',
    label: 'Month 3 assessment',
    opensAt: new Date('2026-03-18T00:00:00Z'),
    dueAt: new Date('2026-04-01T00:00:00Z'),
    graceDays: 7,
    submitted: false,
    ...overrides,
  };
}

describe('evaluateAssessmentGate', () => {
  it('is CLEAR when there are no windows at all', () => {
    const gate = evaluateAssessmentGate([], new Date('2026-04-05T00:00:00Z'));
    expect(gate.state).toBe('CLEAR');
    expect(gate.locked).toBe(false);
    expect(gate.window).toBeNull();
  });

  it('is CLEAR before the window opens, even close to it', () => {
    const gate = evaluateAssessmentGate([windowAt()], new Date('2026-03-17T23:00:00Z'));
    expect(gate.state).toBe('CLEAR');
  });

  it('is CLEAR when the only open window is already submitted', () => {
    const gate = evaluateAssessmentGate(
      [windowAt({ submitted: true })],
      new Date('2026-04-20T00:00:00Z'),
    );
    expect(gate.state).toBe('CLEAR');
    expect(gate.locked).toBe(false);
  });

  it('is DUE once open and before the due date', () => {
    const gate = evaluateAssessmentGate([windowAt()], new Date('2026-03-20T00:00:00Z'));
    expect(gate.state).toBe('DUE');
    expect(gate.locked).toBe(false);
    expect(gate.window?.id).toBe('w1');
    expect(gate.lockAt).toEqual(new Date('2026-04-08T00:00:00Z'));
  });

  it('is GRACE just after the due date', () => {
    const gate = evaluateAssessmentGate([windowAt()], new Date('2026-04-01T00:00:01Z'));
    expect(gate.state).toBe('GRACE');
    expect(gate.locked).toBe(false);
    expect(gate.daysUntilLock).toBe(7);
  });

  it('is still GRACE on the last day of the grace window', () => {
    const gate = evaluateAssessmentGate([windowAt()], new Date('2026-04-07T23:59:00Z'));
    expect(gate.state).toBe('GRACE');
    expect(gate.locked).toBe(false);
  });

  it('LOCKS exactly when the grace window elapses', () => {
    const gate = evaluateAssessmentGate([windowAt()], new Date('2026-04-08T00:00:00Z'));
    expect(gate.state).toBe('LOCKED');
    expect(gate.locked).toBe(true);
  });

  it('LOCKS on the due date itself when grace is zero', () => {
    const gate = evaluateAssessmentGate(
      [windowAt({ graceDays: 0 })],
      new Date('2026-04-01T00:00:00Z'),
    );
    expect(gate.state).toBe('LOCKED');
  });

  it('treats a negative graceDays as zero rather than unlocking early', () => {
    const gate = evaluateAssessmentGate(
      [windowAt({ graceDays: -30 })],
      new Date('2026-04-02T00:00:00Z'),
    );
    expect(gate.state).toBe('LOCKED');
    expect(gate.lockAt).toEqual(new Date('2026-04-01T00:00:00Z'));
  });

  it('targets the EARLIEST outstanding window when several are missed', () => {
    const first = windowAt({ id: 'q1', dueAt: new Date('2026-04-01T00:00:00Z') });
    const second = windowAt({
      id: 'q2',
      opensAt: new Date('2026-06-17T00:00:00Z'),
      dueAt: new Date('2026-07-01T00:00:00Z'),
    });
    const gate = evaluateAssessmentGate([second, first], new Date('2026-07-02T00:00:00Z'));
    expect(gate.window?.id).toBe('q1');
    expect(gate.state).toBe('LOCKED');
  });

  it('moves on to the next window once the earlier one is submitted', () => {
    const first = windowAt({ id: 'q1', submitted: true });
    const second = windowAt({
      id: 'q2',
      opensAt: new Date('2026-06-17T00:00:00Z'),
      dueAt: new Date('2026-07-01T00:00:00Z'),
    });
    const gate = evaluateAssessmentGate([first, second], new Date('2026-06-20T00:00:00Z'));
    expect(gate.window?.id).toBe('q2');
    expect(gate.state).toBe('DUE');
  });

  it('reports negative daysUntilLock once locked', () => {
    const gate = evaluateAssessmentGate([windowAt()], new Date('2026-04-18T00:00:00Z'));
    expect(gate.daysUntilLock).toBe(-10);
  });
});

describe('lockDateFor', () => {
  it('adds the grace window to the due date', () => {
    const lockAt = lockDateFor({ dueAt: new Date('2026-04-01T00:00:00Z'), graceDays: 3 });
    expect(lockAt.getTime()).toBe(new Date('2026-04-01T00:00:00Z').getTime() + 3 * DAY);
  });
});

describe('isAllowedWhileLocked', () => {
  it('allows the assessment, help, support and account routes', () => {
    for (const path of [
      '/assessment',
      '/assessment/history',
      '/support',
      '/help/getting-started',
      '/profile',
      '/settings',
      '/notifications',
    ]) {
      expect(isAllowedWhileLocked(path)).toBe(true);
    }
  });

  it('blocks the rest of the portal', () => {
    for (const path of [
      '/dashboard/mentee',
      '/goals',
      '/sessions',
      '/messages',
      '/meetings',
      '/pair',
      '/journal',
      '/mid-term-review',
      '/reports',
    ]) {
      expect(isAllowedWhileLocked(path)).toBe(false);
    }
  });

  it('does not let a lookalike prefix through', () => {
    expect(isAllowedWhileLocked('/assessments-archive')).toBe(false);
    expect(isAllowedWhileLocked('/helpdesk')).toBe(false);
  });
});
