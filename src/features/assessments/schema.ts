import { z } from 'zod';

// Boundary schemas for the quarterly assessment (CLAUDE.md §3: validate every
// input with Zod). Answer-level validation is shared with the reviews flow —
// features/reviews/schema.ts validateAnswers() runs against the live form.

// Answers arrive as a JSON string in a hidden field, exactly as the review form
// posts them.
const answersJson = z
  .string()
  .trim()
  .min(1, 'No answers were submitted.')
  .transform((rawValue, ctx) => {
    try {
      return JSON.parse(rawValue) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Your answers were malformed.' });
      return z.NEVER;
    }
  })
  .pipe(z.record(z.string(), z.unknown()));

export const submitAssessmentSchema = z.object({
  formId: z.string().cuid(),
  windowId: z.string().cuid(),
  answers: answersJson,
});

export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;

/** Autosave-draft key so a part-finished assessment survives a reload. */
export function assessmentDraftKey(windowId: string, formId: string): string {
  return `assessment:${windowId}:${formId}`;
}

// ── Admin schemas ───────────────────────────────────────────────────────────

/** Generate (or top up) a cohort's assessment windows from its start date. */
export const generateWindowsSchema = z.object({
  cohortId: z.string().cuid(),
  intervalMonths: z.coerce.number().int().min(1).max(24),
  graceDays: z.coerce.number().int().min(0).max(90),
});

const isoDate = z
  .string()
  .trim()
  .min(1, 'A date is required.')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .transform((v) => new Date(v));

export const updateWindowSchema = z
  .object({
    windowId: z.string().cuid(),
    label: z.string().trim().min(2, 'Give this assessment a name.').max(160),
    opensAt: isoDate,
    dueAt: isoDate,
    graceDays: z.coerce.number().int().min(0).max(90),
    isActive: z.coerce.boolean().default(true),
  })
  .refine((v) => v.opensAt.getTime() <= v.dueAt.getTime(), {
    message: 'An assessment cannot be due before it opens.',
    path: ['dueAt'],
  });

export const toggleWindowSchema = z.object({
  windowId: z.string().cuid(),
  isActive: z.coerce.boolean(),
});
