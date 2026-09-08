import { cache } from 'react';
import { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { auth } from './auth';
import { type AdminCohortScope, cohortFilterFor, scopeAllows } from './scope';
import { ADMIN_ROLES } from './roles';

// Authorization errors. Server actions translate these into typed results
// (CLAUDE.md §3: every mutation authenticates → authorizes → validates …).
export class UnauthenticatedError extends Error {
  code = 'UNAUTHENTICATED' as const;
  constructor() {
    super('You must be signed in to perform this action.');
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  code = 'FORBIDDEN' as const;
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  /** Storage key for avatar; used by shell so layouts need no second user query. */
  image: string | null;
  roles: RoleName[];
  adminCohortScope: AdminCohortScope;
  locale: string;
}

const loadActiveUser = cache(async (userId: string): Promise<SessionUser | null> => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      locale: true,
      userRoles: {
        where: { deletedAt: null },
        select: { cohortId: true, role: { select: { name: true } } },
      },
    },
  });
  if (!user) return null;

  const roles = Array.from(new Set(user.userRoles.map((grant) => grant.role.name)));
  const adminGrants = user.userRoles.filter((grant) => ADMIN_ROLES.includes(grant.role.name));
  const adminCohortScope: AdminCohortScope = adminGrants.some((grant) => grant.cohortId === null)
    ? 'ALL'
    : Array.from(
        new Set(
          adminGrants
            .map((grant) => grant.cohortId)
            .filter((cohortId): cohortId is string => cohortId !== null),
        ),
      );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    roles,
    adminCohortScope,
    locale: user.locale,
  };
});

/** Returns the current session user, or null if unauthenticated. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  // JWTs are an authentication credential, not the live authorization source.
  // Re-read active status and grants so disabling a user or changing a role
  // takes effect immediately instead of waiting for the 12-hour token to expire.
  return loadActiveUser(session.user.id);
}

/** Asserts the request is authenticated and returns the user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export function hasAnyRole(user: SessionUser, allowed: RoleName | RoleName[]): boolean {
  const allow = Array.isArray(allowed) ? allowed : [allowed];
  return user.roles.some((r) => allow.includes(r));
}

/**
 * Server-side RBAC guard (CLAUDE.md §4). Call at the top of every protected
 * server action: `const user = await requireRole(['SUPER_ADMIN']);`
 * Throws UnauthenticatedError / ForbiddenError, which mapActionError() turns
 * into a typed failure result.
 */
export async function requireRole(allowed: RoleName | RoleName[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasAnyRole(user, allowed)) {
    throw new ForbiddenError();
  }
  return user;
}

/**
 * Prisma `where` fragment that confines an admin read to the cohorts the admin
 * may actually see (m2-audit-findings H1). Spread it into any cohort-scoped admin
 * query: `where: { deletedAt: null, ...adminCohortFilter(user) }`.
 *
 * A global admin ('ALL') gets `{}` (every cohort, unchanged). A cohort-scoped
 * admin gets `{ cohortId: { in: [...] } }` — an empty scope yields `{ in: [] }`,
 * which matches nothing (fail-closed).
 */
export function adminCohortFilter(user: SessionUser): { cohortId?: { in: string[] } } {
  return cohortFilterFor(user.adminCohortScope);
}

/** True when `user` may act on data in `cohortId`. */
export function canAccessCohort(user: SessionUser, cohortId: string): boolean {
  return scopeAllows(user.adminCohortScope, cohortId);
}

/** Asserts cohort access, throwing ForbiddenError otherwise. */
export function assertCohortAccess(user: SessionUser, cohortId: string): void {
  if (!canAccessCohort(user, cohortId)) {
    throw new ForbiddenError('This record belongs to a cohort you cannot access.');
  }
}
