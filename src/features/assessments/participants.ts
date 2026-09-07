import { ReviewType, RoleName } from '@prisma/client';

// ──────────────────────────────────────────────────────────────────────────
// Who must complete which recurring form (pure — no I/O, unit tested).
//
// The two recurring forms have different audiences, and getting this wrong in
// either direction is a real failure: too wide and someone is chased for (or
// locked out over) a form that was never theirs; too narrow and an obligation
// silently disappears. So the rule lives in one place rather than as an
// `includes(MENTEE)` scattered through the queries.
//
//   QUARTERLY assessment  → mentors AND mentees, and it gates portal access
//                           for both.
//   MONTHLY meeting form  → mentees only, and it gates nothing.
// ──────────────────────────────────────────────────────────────────────────

/** The recurring forms, in the order a participant sees them. */
export const RECURRING_FORM_TYPES = [ReviewType.MONTHLY, ReviewType.QUARTERLY] as const;

export type RecurringFormType = (typeof RECURRING_FORM_TYPES)[number];

export function isRecurringFormType(type: ReviewType): type is RecurringFormType {
  return type === ReviewType.MONTHLY || type === ReviewType.QUARTERLY;
}

/** Participant roles required to complete `formType`. */
export function rolesRequiredFor(formType: RecurringFormType): RoleName[] {
  switch (formType) {
    case ReviewType.QUARTERLY:
      return [RoleName.MENTOR, RoleName.MENTEE];
    case ReviewType.MONTHLY:
      return [RoleName.MENTEE];
  }
}

/**
 * The recurring forms a user must complete. Empty for anyone who is neither a
 * mentor nor a mentee — an admin holds neither obligation.
 */
export function formTypesFor(roles: RoleName[]): RecurringFormType[] {
  return RECURRING_FORM_TYPES.filter((formType) =>
    rolesRequiredFor(formType).some((role) => roles.includes(role)),
  );
}

/** True when someone holding `roles` must complete `formType`. */
export function mustComplete(roles: RoleName[], formType: RecurringFormType): boolean {
  return rolesRequiredFor(formType).some((role) => roles.includes(role));
}

/**
 * The role a user answers `formType` as, which selects the role-specific
 * FormDefinition (the quarterly assessment has a distinct mentor and mentee
 * question set). Null when they hold no required role.
 *
 * A user who is somehow both mentor and mentee answers as a mentee: that is the
 * side with the development goals the assessment is mostly about.
 */
export function respondentRoleFor(
  roles: RoleName[],
  formType: RecurringFormType,
): RoleName | null {
  const required = rolesRequiredFor(formType);
  if (required.includes(RoleName.MENTEE) && roles.includes(RoleName.MENTEE)) {
    return RoleName.MENTEE;
  }
  if (required.includes(RoleName.MENTOR) && roles.includes(RoleName.MENTOR)) {
    return RoleName.MENTOR;
  }
  return null;
}
