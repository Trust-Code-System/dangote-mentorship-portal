import { describe, it, expect } from 'vitest';
import { cohortFilterFor, scopeAllows, type AdminCohortScope } from '@/lib/auth/scope';

// Locks the H1 fix (m2-audit-findings): admin reads must be confined to the
// cohorts an admin was granted, while a global admin keeps full reach. These are
// the pure primitives behind rbac's adminCohortFilter/canAccessCohort/assertCohortAccess.

describe('cohortFilterFor', () => {
  it('returns an empty filter for a global admin (every cohort)', () => {
    expect(cohortFilterFor('ALL')).toEqual({});
  });

  it('confines a cohort-scoped admin to their granted cohorts', () => {
    expect(cohortFilterFor(['c1', 'c2'])).toEqual({ cohortId: { in: ['c1', 'c2'] } });
  });

  it('fails closed for an admin with no cohort grants (matches nothing)', () => {
    const scope: AdminCohortScope = [];
    expect(cohortFilterFor(scope)).toEqual({ cohortId: { in: [] } });
  });
});

describe('scopeAllows', () => {
  it('global admin can access any cohort', () => {
    expect(scopeAllows('ALL', 'anything')).toBe(true);
  });

  it('scoped admin can access only granted cohorts', () => {
    expect(scopeAllows(['c1'], 'c1')).toBe(true);
    expect(scopeAllows(['c1'], 'c2')).toBe(false);
  });

  it('empty scope denies everything', () => {
    expect(scopeAllows([], 'c1')).toBe(false);
  });
});
