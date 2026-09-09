import { z } from 'zod';
import { ReviewType, RoleName } from '@prisma/client';

// ──────────────────────────────────────────────────────────────────────────
// Form Builder (CLAUDE.md §5 Reviews, §13 "Forms Builder", M3).
//
// Mid/end reviews are stored as editable `form_definitions` (+ `form_responses`)
// so admins can change the questions without a code change. This file defines
// the canonical shape of a form's `schema` JSON — the single contract that both
// the builder (admin authoring) and the future review-fill flow (respondents)
// consume. Keep it strict: it is validated at the boundary on every save.
// ──────────────────────────────────────────────────────────────────────────

// Question input types the renderer knows how to draw and the response flow
// knows how to validate. Kept small and explicit on purpose.
export const FORM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'rating',
  'single_select',
  // Tick as many as apply. The programme's paper forms use checkbox lists for
  // questions like "what support do you need?", where forcing one answer would
  // lose information.
  'multi_select',
  'boolean',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

// Bilingual everywhere (CLAUDE.md §6 cross-cutting; design-system §6): every
// question label and option carries EN + FR, so a French respondent is never
// forced into English.
//
// The FR half is optional *at this layer* only. Whether it is actually required
// depends on the cohort the form belongs to, which this schema does not know:
// a cohort with no French participants (Cohort.languages = [EN]) would
// otherwise force an admin to invent French text for a form nobody will read in
// French. The cohort-aware requirement is `missingFrenchLabels()` below, applied
// by the server action once it has resolved the cohort. Stored French text is
// never cleared by this — an empty submission for an EN-only cohort simply
// carries no FR, and the renderers fall back to EN.
const optionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  labelEn: z.string().trim().min(1, 'Option label (EN) is required').max(160),
  labelFr: z.string().trim().max(160).default(''),
});

export const formFieldSchema = z
  .object({
    // Stable key the answer is recorded under. Generated client-side, never
    // reused, so editing a form doesn't orphan existing responses by accident.
    id: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Field id must be alphanumeric'),
    labelEn: z.string().trim().min(1, 'Question (EN) is required').max(400),
    // Optional here; required per-cohort via `missingFrenchLabels()`.
    labelFr: z.string().trim().max(400).default(''),
    type: z.enum(FORM_FIELD_TYPES),
    required: z.boolean().default(false),
    // Rating scale upper bound (1..max). Only meaningful for `rating`.
    max: z.number().int().min(2).max(10).optional(),
    // Only meaningful for `single_select` / `multi_select`.
    options: z.array(optionSchema).max(20).optional(),
    // Cap on how many options may be ticked. Only meaningful for
    // `multi_select`; unset means "any number".
    maxSelections: z.number().int().min(1).max(20).optional(),
  })
  .superRefine((field, ctx) => {
    const needsOptions = field.type === 'single_select' || field.type === 'multi_select';
    if (needsOptions && (!field.options || field.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A multiple-choice question needs at least two options.',
        path: ['options'],
      });
    }
    // A cap above the number of options is not wrong so much as meaningless,
    // and it would let an author think they had limited something.
    if (
      field.type === 'multi_select' &&
      field.maxSelections !== undefined &&
      field.options &&
      field.maxSelections > field.options.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The limit cannot exceed the number of options.',
        path: ['maxSelections'],
      });
    }
  });

export type FormField = z.infer<typeof formFieldSchema>;

export const formSchemaShape = z
  .object({
    fields: z
      .array(formFieldSchema)
      .min(1, 'Add at least one question.')
      .max(50, 'A form can have at most 50 questions.'),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.fields.forEach((field, index) => {
      if (seen.has(field.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each question must have a unique id.',
          path: ['fields', index, 'id'],
        });
      }
      seen.add(field.id);
    });
  });

export type FormSchemaShape = z.infer<typeof formSchemaShape>;

/** Where a required French label is missing, for a per-field error message. */
export interface MissingFrenchLabel {
  /** 0-based question index, as shown in the builder. */
  fieldIndex: number;
  /** 0-based option index, or null when it is the question label itself. */
  optionIndex: number | null;
}

/**
 * Questions/options with no French text — the cohort-aware half of validation.
 *
 * Called by the server action only when the form's cohort actually offers
 * French (`requiresFrench` in features/cohorts/languages.ts). For an
 * English-only cohort it is never called, so the admin is never asked to invent
 * French; ticking French back on makes the same forms require it again, with any
 * French already stored still in place.
 */
export function missingFrenchLabels(shape: FormSchemaShape): MissingFrenchLabel[] {
  const missing: MissingFrenchLabel[] = [];
  shape.fields.forEach((field, fieldIndex) => {
    if (field.labelFr.trim() === '') {
      missing.push({ fieldIndex, optionIndex: null });
    }
    field.options?.forEach((option, optionIndex) => {
      if (option.labelFr.trim() === '') {
        missing.push({ fieldIndex, optionIndex });
      }
    });
  });
  return missing;
}

/** Human-readable summary of the first few missing French labels. */
export function describeMissingFrenchLabels(missing: MissingFrenchLabel[]): string {
  const parts = missing.slice(0, 4).map((m) =>
    m.optionIndex === null
      ? `question ${m.fieldIndex + 1}`
      : `question ${m.fieldIndex + 1} option ${m.optionIndex + 1}`,
  );
  const more = missing.length - parts.length;
  const list = more > 0 ? `${parts.join(', ')} and ${more} more` : parts.join(', ');
  return `This cohort runs in French, so every question needs French text. Missing: ${list}.`;
}

// `schema` arrives from the client as a JSON string in a hidden field; parse
// then validate against the canonical shape.
const schemaJson = z
  .string()
  .trim()
  .min(1, 'Add at least one question.')
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The form layout is malformed.' });
      return z.NEVER;
    }
  })
  .pipe(formSchemaShape);

// Empty string → null (form applies to every role); otherwise a valid role.
const optionalRole = z
  .union([z.literal(''), z.nativeEnum(RoleName)])
  .optional()
  .transform((v) => (v ? (v as RoleName) : null));

export const createFormDefinitionSchema = z.object({
  cohortId: z.string().cuid(),
  type: z.nativeEnum(ReviewType),
  roleName: optionalRole,
  title: z.string().trim().min(2, 'Title is too short').max(200),
  schema: schemaJson,
  isActive: z.coerce.boolean().default(true),
});

export const updateFormDefinitionSchema = createFormDefinitionSchema.extend({
  id: z.string().cuid(),
});

export const formDefinitionIdSchema = z.object({ id: z.string().cuid() });

export type CreateFormDefinitionInput = z.infer<typeof createFormDefinitionSchema>;
export type UpdateFormDefinitionInput = z.infer<typeof updateFormDefinitionSchema>;

/** Install the standard question sets into one cohort. */
export const installStandardFormsSchema = z.object({ cohortId: z.string().cuid() });
