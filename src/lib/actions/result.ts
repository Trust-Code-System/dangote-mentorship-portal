import { ZodError } from 'zod';
import { ForbiddenError, UnauthenticatedError } from '@/lib/auth/rbac';
import { reportError } from '@/lib/observability/report';

// Typed result returned by every server action (CLAUDE.md §3, §8: actions
// return a typed result rather than throwing across the RSC boundary).
export type ActionError = {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'UNKNOWN';
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionError): ActionResult<never> {
  return { ok: false, error };
}

/** Normalizes thrown errors (authz, Zod, unexpected) into an ActionError. */
export function mapActionError(error: unknown): ActionResult<never> {
  if (error instanceof UnauthenticatedError) {
    return fail({ code: 'UNAUTHENTICATED', message: error.message });
  }
  if (error instanceof ForbiddenError) {
    return fail({ code: 'FORBIDDEN', message: error.message });
  }
  if (error instanceof ZodError) {
    return fail({
      code: 'VALIDATION',
      message: 'Some fields are invalid.',
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    });
  }
  // Unexpected/internal: never leak details to the client (CLAUDE.md §14), but
  // DO capture the real error server-side (Sentry when configured) so opaque
  // "Something went wrong" failures in production are diagnosable rather than blind.
  reportError(error, { source: 'action' });
  return fail({ code: 'UNKNOWN', message: 'Something went wrong. Please try again.' });
}
