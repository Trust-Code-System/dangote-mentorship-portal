import 'server-only';
import { cache } from 'react';
import { Language } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  DEFAULT_COHORT_LANGUAGES,
  cohortLanguages,
  type CohortLanguageSource,
} from './languages';

// Server-side reads that feed the pure helpers in ./languages.ts. Kept separate
// so the decision logic stays importable from tests and client components
// without dragging Prisma along.
//
// Both reads are request-cached: a page that asks "does this cohort want French?"
// in three components issues one query.

/** The languages one cohort operates in. Unknown/soft-deleted → bilingual default. */
export const getCohortLanguages = cache(
  async (cohortId: string | null | undefined): Promise<Language[]> => {
    if (!cohortId) return [...DEFAULT_COHORT_LANGUAGES];
    const cohort = await prisma.cohort.findFirst({
      where: { id: cohortId, deletedAt: null },
      select: { languages: true },
    });
    return cohortLanguages(cohort);
  },
);

/**
 * The languages the signed-in participant's own cohort operates in.
 *
 * Resolved from their mentee profile first, then their mentor profile — the
 * same precedence the rest of the portal uses when someone holds both. Someone
 * with neither profile (an admin, or a user invited but not yet imported) has
 * no cohort of their own, so they get the bilingual default: an admin's screens
 * are cohort-scoped by the record they are looking at, not by who they are.
 */
export const getViewerCohortLanguages = cache(async (userId: string): Promise<Language[]> => {
  const [mentee, mentor] = await Promise.all([
    prisma.menteeProfile.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { cohortId: true },
    }),
    prisma.mentorProfile.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { cohortId: true },
    }),
  ]);
  const cohortId = mentee?.cohortId ?? mentor?.cohortId ?? null;
  return getCohortLanguages(cohortId);
});

/** Adapter so a fetched `Language[]` can be passed back into the pure helpers. */
export function asLanguageSource(languages: Language[]): CohortLanguageSource {
  return { languages };
}
