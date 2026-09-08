import { describe, expect, it } from 'vitest';
import { ReviewType, RoleName } from '@prisma/client';
import {
  RECURRING_FORM_TYPES,
  formTypesFor,
  isRecurringFormType,
  mustComplete,
  respondentRoleFor,
  rolesRequiredFor,
} from '@/features/assessments/participants';

// Getting this wrong is a real failure in both directions: too wide and someone
// is locked out over a form that was never theirs, too narrow and an obligation
// silently vanishes. Hence the exhaustive coverage of a small module.

describe('rolesRequiredFor', () => {
  it('requires both mentors and mentees for the quarterly assessment', () => {
    expect(rolesRequiredFor(ReviewType.QUARTERLY).sort()).toEqual(
      [RoleName.MENTEE, RoleName.MENTOR].sort(),
    );
  });

  it('requires only mentees for the monthly meeting form', () => {
    expect(rolesRequiredFor(ReviewType.MONTHLY)).toEqual([RoleName.MENTEE]);
  });

  it('never requires an admin role', () => {
    for (const formType of RECURRING_FORM_TYPES) {
      expect(rolesRequiredFor(formType)).not.toContain(RoleName.SUPER_ADMIN);
    }
  });
});

describe('formTypesFor', () => {
  it('gives a mentee both forms', () => {
    expect(formTypesFor([RoleName.MENTEE]).sort()).toEqual(
      [ReviewType.MONTHLY, ReviewType.QUARTERLY].sort(),
    );
  });

  it('gives a mentor only the quarterly assessment', () => {
    expect(formTypesFor([RoleName.MENTOR])).toEqual([ReviewType.QUARTERLY]);
  });

  it('gives an admin nothing', () => {
    expect(formTypesFor([RoleName.SUPER_ADMIN])).toEqual([]);
  });

  it('gives someone with no roles nothing', () => {
    expect(formTypesFor([])).toEqual([]);
  });

  it('gives an admin who is also a mentor the mentor set', () => {
    expect(formTypesFor([RoleName.SUPER_ADMIN, RoleName.MENTOR])).toEqual([
      ReviewType.QUARTERLY,
    ]);
  });
});

describe('mustComplete', () => {
  it('holds a mentor to the quarterly assessment but not the monthly form', () => {
    expect(mustComplete([RoleName.MENTOR], ReviewType.QUARTERLY)).toBe(true);
    expect(mustComplete([RoleName.MENTOR], ReviewType.MONTHLY)).toBe(false);
  });

  it('holds a mentee to both', () => {
    expect(mustComplete([RoleName.MENTEE], ReviewType.QUARTERLY)).toBe(true);
    expect(mustComplete([RoleName.MENTEE], ReviewType.MONTHLY)).toBe(true);
  });

  it('holds an admin to neither', () => {
    expect(mustComplete([RoleName.SUPER_ADMIN], ReviewType.QUARTERLY)).toBe(false);
    expect(mustComplete([RoleName.SUPER_ADMIN], ReviewType.MONTHLY)).toBe(false);
  });
});

describe('respondentRoleFor', () => {
  it('answers as a mentee when they are a mentee', () => {
    expect(respondentRoleFor([RoleName.MENTEE], ReviewType.QUARTERLY)).toBe(RoleName.MENTEE);
  });

  it('answers as a mentor when they are a mentor', () => {
    expect(respondentRoleFor([RoleName.MENTOR], ReviewType.QUARTERLY)).toBe(RoleName.MENTOR);
  });

  it('prefers the mentee question set for someone who is both', () => {
    expect(respondentRoleFor([RoleName.MENTOR, RoleName.MENTEE], ReviewType.QUARTERLY)).toBe(
      RoleName.MENTEE,
    );
  });

  it('returns null for a mentor on the monthly form, which is not theirs', () => {
    expect(respondentRoleFor([RoleName.MENTOR], ReviewType.MONTHLY)).toBeNull();
  });

  it('returns null for an admin', () => {
    expect(respondentRoleFor([RoleName.SUPER_ADMIN], ReviewType.QUARTERLY)).toBeNull();
  });
});

describe('isRecurringFormType', () => {
  it('accepts the two recurring forms', () => {
    expect(isRecurringFormType(ReviewType.QUARTERLY)).toBe(true);
    expect(isRecurringFormType(ReviewType.MONTHLY)).toBe(true);
  });

  it('rejects the one-off reviews', () => {
    expect(isRecurringFormType(ReviewType.MIDTERM)).toBe(false);
    expect(isRecurringFormType(ReviewType.FINAL)).toBe(false);
  });
});
