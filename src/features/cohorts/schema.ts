import { z } from 'zod';
import { CohortStatus, Language } from '@prisma/client';

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), 'Invalid date');

// Shared fields. The end-after-start check is applied as a refinement on both the
// create and update schemas below (QA-COHORT-008: a cohort must never have an end
// date before its start date, which corrupts journey/review-window date logic).
const cohortBaseSchema = z.object({
  programmeId: z.string().cuid(),
  name: z.string().trim().min(2, 'Name is too short').max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  startDate: optionalDate,
  endDate: optionalDate,
  // At least one language must be offered (CLAUDE.md §1: EN + FR).
  languages: z.array(z.nativeEnum(Language)).min(1, 'Select at least one language'),
});

// end must be strictly after start when both are provided.
const endAfterStart = (v: { startDate: Date | null; endDate: Date | null }) =>
  !v.startDate || !v.endDate || v.endDate.getTime() > v.startDate.getTime();
const endAfterStartError = {
  message: 'End date must be after the start date',
  path: ['endDate'] as string[],
};

export const createCohortSchema = cohortBaseSchema.refine(endAfterStart, endAfterStartError);

export const updateCohortSchema = cohortBaseSchema
  .extend({
    id: z.string().cuid(),
    status: z.nativeEnum(CohortStatus),
  })
  .refine(endAfterStart, endAfterStartError);

export const archiveCohortSchema = z.object({ id: z.string().cuid() });

export type CreateCohortInput = z.infer<typeof createCohortSchema>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;
