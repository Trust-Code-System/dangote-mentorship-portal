import 'server-only';
import { cache } from 'react';
import { ReviewType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export const QUARTERLY_DISABLED_FLAG = 'quarterly_assessments_disabled';

// Opt out per stream; absence preserves the assessment rules of older cohorts.
// No global flag may silently disable another cohort's obligations.
export const quarterlyAssessmentsEnabled = cache(async (cohortId: string): Promise<boolean> => {
  const flag = await prisma.featureFlag.findFirst({
    where: { key: QUARTERLY_DISABLED_FLAG, cohortId, deletedAt: null },
    select: { enabled: true },
  });
  return !flag?.enabled;
});

export async function recurringFormEnabled(cohortId: string, formType: ReviewType) {
  return formType !== ReviewType.QUARTERLY || (await quarterlyAssessmentsEnabled(cohortId));
}
