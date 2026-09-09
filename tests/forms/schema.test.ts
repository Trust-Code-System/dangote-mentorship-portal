import { describe, expect, it } from 'vitest';
import {
  createFormDefinitionSchema,
  describeMissingFrenchLabels,
  formSchemaShape,
  missingFrenchLabels,
  type FormSchemaShape,
} from '@/features/forms/schema';

// The form `schema` JSON is the contract both the builder and the review-fill
// flow depend on, so it gets full unit coverage (CLAUDE.md §0 rule 4 spirit:
// validation is non-negotiable).

function field(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q_one',
    labelEn: 'How did it go?',
    labelFr: 'Comment cela s’est-il passé ?',
    type: 'long_text',
    required: true,
    ...overrides,
  };
}

describe('formSchemaShape', () => {
  it('accepts a minimal valid form', () => {
    const result = formSchemaShape.safeParse({ fields: [field()] });
    expect(result.success).toBe(true);
  });

  it('rejects a form with no questions', () => {
    const result = formSchemaShape.safeParse({ fields: [] });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate field ids', () => {
    const result = formSchemaShape.safeParse({
      fields: [field({ id: 'dupe' }), field({ id: 'dupe', labelEn: 'Second', labelFr: 'Deux' })],
    });
    expect(result.success).toBe(false);
  });

  it('always requires an EN label on every question', () => {
    expect(formSchemaShape.safeParse({ fields: [field({ labelEn: '' })] }).success).toBe(false);
  });

  // FR is accepted-but-empty at this layer on purpose: whether French is
  // actually required depends on the cohort, which this schema cannot see.
  // `missingFrenchLabels` is the cohort-aware half (see below).
  it('accepts an empty FR label, deferring the decision to the cohort', () => {
    expect(formSchemaShape.safeParse({ fields: [field({ labelFr: '' })] }).success).toBe(true);
  });

  it('defaults a wholly absent FR label to an empty string', () => {
    const result = formSchemaShape.safeParse({
      fields: [{ id: 'q_one', labelEn: 'Only English', type: 'long_text', required: false }],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.fields[0]?.labelFr).toBe('');
  });

  it('rejects a non-alphanumeric field id', () => {
    expect(formSchemaShape.safeParse({ fields: [field({ id: 'bad id!' })] }).success).toBe(false);
  });

  it('requires at least two options for a single_select question', () => {
    const oneOption = formSchemaShape.safeParse({
      fields: [
        field({
          type: 'single_select',
          options: [{ value: 'a', labelEn: 'A', labelFr: 'A' }],
        }),
      ],
    });
    expect(oneOption.success).toBe(false);

    const twoOptions = formSchemaShape.safeParse({
      fields: [
        field({
          type: 'single_select',
          options: [
            { value: 'a', labelEn: 'A', labelFr: 'A' },
            { value: 'b', labelEn: 'B', labelFr: 'B' },
          ],
        }),
      ],
    });
    expect(twoOptions.success).toBe(true);
  });

  it('clamps rating bounds to 2..10', () => {
    expect(formSchemaShape.safeParse({ fields: [field({ type: 'rating', max: 1 })] }).success).toBe(
      false,
    );
    expect(formSchemaShape.safeParse({ fields: [field({ type: 'rating', max: 11 })] }).success).toBe(
      false,
    );
    expect(formSchemaShape.safeParse({ fields: [field({ type: 'rating', max: 5 })] }).success).toBe(
      true,
    );
  });

  it('defaults required to false when omitted', () => {
    const parsed = formSchemaShape.parse({ fields: [field({ required: undefined })] }) as FormSchemaShape;
    expect(parsed.fields[0]?.required).toBe(false);
  });
});

describe('createFormDefinitionSchema', () => {
  const validSchemaJson = JSON.stringify({ fields: [field()] });

  it('parses a full valid payload and coerces an empty role to null', () => {
    const result = createFormDefinitionSchema.safeParse({
      cohortId: 'ckv1234567890abcdefghijklm',
      type: 'MIDTERM',
      roleName: '',
      title: 'Mid-term mentee review',
      schema: validSchemaJson,
      isActive: 'true',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roleName).toBeNull();
      expect(result.data.schema.fields).toHaveLength(1);
    }
  });

  it('keeps a concrete target role', () => {
    const result = createFormDefinitionSchema.safeParse({
      cohortId: 'ckv1234567890abcdefghijklm',
      type: 'FINAL',
      roleName: 'MENTOR',
      title: 'Final mentor review',
      schema: validSchemaJson,
      isActive: 'true',
    });
    expect(result.success && result.data.roleName).toBe('MENTOR');
  });

  it('rejects malformed schema JSON', () => {
    const result = createFormDefinitionSchema.safeParse({
      cohortId: 'ckv1234567890abcdefghijklm',
      type: 'MIDTERM',
      roleName: '',
      title: 'Broken',
      schema: '{ not json',
      isActive: 'true',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid review type', () => {
    const result = createFormDefinitionSchema.safeParse({
      cohortId: 'ckv1234567890abcdefghijklm',
      type: 'WEEKLY',
      roleName: '',
      title: 'Bad type',
      schema: validSchemaJson,
      isActive: 'true',
    });
    expect(result.success).toBe(false);
  });
});

// The cohort-aware half of the French requirement. A cohort with FR still gets
// every question checked; a cohort without it never reaches this code, so an
// admin running an English-only programme is never asked to invent French.
describe('missingFrenchLabels', () => {
  const parse = (fields: unknown[]): FormSchemaShape => {
    const result = formSchemaShape.safeParse({ fields });
    if (!result.success) throw new Error('fixture failed to parse');
    return result.data;
  };

  it('finds nothing when every question and option carries French', () => {
    const shape = parse([
      field(),
      field({
        id: 'q_two',
        type: 'single_select',
        options: [
          { value: 'a', labelEn: 'A', labelFr: 'A-fr' },
          { value: 'b', labelEn: 'B', labelFr: 'B-fr' },
        ],
      }),
    ]);
    expect(missingFrenchLabels(shape)).toEqual([]);
  });

  it('reports a question missing its French label', () => {
    const shape = parse([field(), field({ id: 'q_two', labelFr: '' })]);
    expect(missingFrenchLabels(shape)).toEqual([{ fieldIndex: 1, optionIndex: null }]);
  });

  it('reports an option missing its French label', () => {
    const shape = parse([
      field({
        type: 'single_select',
        options: [
          { value: 'a', labelEn: 'A', labelFr: 'A-fr' },
          { value: 'b', labelEn: 'B', labelFr: '   ' },
        ],
      }),
    ]);
    expect(missingFrenchLabels(shape)).toEqual([{ fieldIndex: 0, optionIndex: 1 }]);
  });

  it('reports the question and its options independently', () => {
    const shape = parse([
      field({
        labelFr: '',
        type: 'single_select',
        options: [
          { value: 'a', labelEn: 'A', labelFr: '' },
          { value: 'b', labelEn: 'B', labelFr: 'B-fr' },
        ],
      }),
    ]);
    expect(missingFrenchLabels(shape)).toEqual([
      { fieldIndex: 0, optionIndex: null },
      { fieldIndex: 0, optionIndex: 0 },
    ]);
  });
});

describe('describeMissingFrenchLabels', () => {
  it('names the questions in one-based terms an admin can find', () => {
    const message = describeMissingFrenchLabels([
      { fieldIndex: 0, optionIndex: null },
      { fieldIndex: 2, optionIndex: 1 },
    ]);
    expect(message).toContain('question 1');
    expect(message).toContain('question 3 option 2');
  });

  it('summarizes rather than listing every one', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ fieldIndex: i, optionIndex: null }));
    expect(describeMissingFrenchLabels(many)).toContain('and 5 more');
  });
});
