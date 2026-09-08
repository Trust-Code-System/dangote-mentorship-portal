// Cross-cohort reach of an admin session (m2-audit-findings H1). Kept in its own
// edge-safe module (no Prisma import) so both the edge `auth.config` session
// callback and the Node `auth.ts` jwt callback can share the type without pulling
// the Prisma client into the edge bundle.
//
//   'ALL'      → a global admin grant (cohortId null, e.g. Super Admin): every cohort.
//   string[]   → confined to exactly these cohort ids (a cohort-scoped admin).
export type AdminCohortScope = 'ALL' | string[];

/**
 * Prisma `where` fragment confining a read to the cohorts in `scope`. A global
 * scope yields `{}` (every cohort); a list yields `{ cohortId: { in: [...] } }`
 * (an empty list matches nothing — fail-closed). Pure + edge-safe so it's unit
 * testable without the next-auth graph.
 */
export function cohortFilterFor(scope: AdminCohortScope): { cohortId?: { in: string[] } } {
  if (scope === 'ALL') return {};
  return { cohortId: { in: scope } };
}

/** True when `scope` permits acting on `cohortId`. */
export function scopeAllows(scope: AdminCohortScope, cohortId: string): boolean {
  return scope === 'ALL' || scope.includes(cohortId);
}
