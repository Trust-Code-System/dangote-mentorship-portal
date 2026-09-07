import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleName } from '@prisma/client';

// The guarantee under test: **a non-gating form can never lock anyone out.**
//
// That property does not live in the pure gate function (which faithfully locks
// on any overdue window it is handed) — it lives in the DATABASE QUERY that
// decides which windows the gate ever sees. So this test asserts the query,
// which is the thing that would silently regress if someone "simplified" the
// where clause. tests/assessments/gate.test.ts covers the pure logic.

vi.mock('server-only', () => ({}));

const findMany = vi.fn();
const userRoleFindFirst = vi.fn();
const getMenteePairing = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    assessmentWindow: { findMany: (...args: unknown[]) => findMany(...args) },
    userRole: { findFirst: (...args: unknown[]) => userRoleFindFirst(...args) },
  },
}));

vi.mock('@/lib/pairings', () => ({
  getMenteePairing: (...args: unknown[]) => getMenteePairing(...args),
  getMentorPairings: vi.fn(),
}));

// rbac pulls in next-auth (and therefore next/server), which will not load under
// Vitest. Only `hasAnyRole` is actually used by the module under test; it is a
// one-line predicate covered directly by tests/auth/roles.test.ts, so
// re-stating it here does not hide anything.
vi.mock('@/lib/auth/rbac', () => ({
  hasAnyRole: (user: { roles: string[] }, allowed: string | string[]) => {
    const allow = Array.isArray(allowed) ? allowed : [allowed];
    return user.roles.some((role) => allow.includes(role));
  },
}));

vi.mock('@/features/forms/data', () => ({
  getActiveFormDefinition: vi.fn(),
}));

const { getAssessmentGate, isGatedRole } = await import('@/features/assessments/data');

const mentee = {
  id: 'user-1',
  email: 'mentee@example.com',
  name: 'A Mentee',
  image: null,
  roles: [RoleName.MENTEE],
  adminCohortScope: [] as string[],
  locale: 'EN',
};

/**
 * A window whose due date is long past, with no grace, and unsubmitted — the
 * pure gate LOCKS on this whenever it sees it. Dated in the past on purpose so
 * the test does not change meaning as the real clock moves.
 */
const overdueWindow = {
  id: 'w-overdue',
  label: 'January 2020 form',
  opensAt: new Date('2020-01-01T00:00:00Z'),
  dueAt: new Date('2020-01-31T23:59:59Z'),
  graceDays: 0,
  responses: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getMenteePairing.mockResolvedValue({ cohortId: 'cohort-1', mentorId: 'm1', mentorName: 'M' });
  findMany.mockResolvedValue([]);
});

describe('getAssessmentGate window scope', () => {
  it('only ever asks the database for GATING windows', async () => {
    await getAssessmentGate(mentee);

    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0]?.[0]?.where;
    // This single assertion is the whole safety property.
    expect(where).toMatchObject({ gatesAccess: true });
  });

  it('also confines the query to the cohort and to live windows', async () => {
    await getAssessmentGate({ ...mentee, id: 'user-scope' });

    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      cohortId: 'cohort-1',
      isActive: true,
      gatesAccess: true,
      deletedAt: null,
    });
  });

  it('would lock on an overdue GATING window (proves the test is not vacuous)', async () => {
    // Same overdue window, returned as if it were a gating one: the gate locks.
    findMany.mockResolvedValue([overdueWindow]);
    const gate = await getAssessmentGate({ ...mentee, id: 'user-lockable' });
    expect(gate.locked).toBe(true);
    expect(gate.state).toBe('LOCKED');
  });

  it('is CLEAR when the query returns nothing, which is what a monthly-only cohort yields', async () => {
    findMany.mockResolvedValue([]);
    const gate = await getAssessmentGate({ ...mentee, id: 'user-monthly-only' });
    expect(gate.locked).toBe(false);
    expect(gate.state).toBe('CLEAR');
  });

  it('never queries at all for a user who is not a gated role', async () => {
    const mentor = { ...mentee, id: 'user-mentor', roles: [RoleName.MENTOR] };
    const gate = await getAssessmentGate(mentor);
    expect(gate.state).toBe('CLEAR');
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('isGatedRole', () => {
  it('gates mentees', () => {
    expect(isGatedRole(mentee)).toBe(true);
  });

  it('does not gate mentors', () => {
    expect(isGatedRole({ ...mentee, roles: [RoleName.MENTOR] })).toBe(false);
  });

  it('does not gate admins, even when they also hold a mentee role', () => {
    expect(
      isGatedRole({ ...mentee, roles: [RoleName.SUPER_ADMIN, RoleName.MENTEE] }),
    ).toBe(false);
  });
});
