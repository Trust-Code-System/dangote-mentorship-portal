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
// question label and option carries EN + FR. French respondents are never
// forced into English.
const optionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  labelEn: z.string().trim().min(1, 'Option label (EN) is required').max(160),
  labelFr: z.string().trim().min(1, 'Option label (FR) is required').max(160),
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
    labelFr: z.string().trim().min(1, 'Question (FR) is required').max(400),
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
