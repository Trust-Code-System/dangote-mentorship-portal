import { describe, expect, it } from 'vitest';
import { formSchemaShape } from '@/features/forms/schema';
import { validateAnswers } from '@/features/reviews/schema';
import type { FormSchemaShape } from '@/features/forms/schema';

// The validation engine is one of the two non-negotiable full-coverage areas
// (CLAUDE.md §0 rule 4), and multi_select is the first field type whose answer
// is not a scalar — so the storage shape, the option allow-list and the
// selection cap are all pinned down here.

function schemaWith(field: Record<string, unknown>): FormSchemaShape {
  const parsed = formSchemaShape.safeParse({ fields: [field] });
  if (!parsed.success) throw new Error(`fixture invalid: ${parsed.error.message}`);
  return parsed.data;
}

const support = {
  id: 'support_needed',
  labelEn: 'What support do you need?',
  labelFr: 'De quel soutien avez-vous besoin ?',
  type: 'multi_select',
  required: true,
  options: [
    { value: 'engagement', labelEn: 'More engagement', labelFr: 'Plus d’engagement' },
    { value: 'goals', labelEn: 'Goal refinement', labelFr: 'Affiner les objectifs' },
    { value: 'checkins', labelEn: 'More check-ins', labelFr: 'Plus de points' },
    { value: 'peer', labelEn: 'Peer support', labelFr: 'Soutien des pairs' },
  ],
};

describe('form schema: multi_select authoring', () => {
  it('accepts a multi_select with options', () => {
    expect(formSchemaShape.safeParse({ fields: [support] }).success).toBe(true);
  });

  it('rejects a multi_select with fewer than two options', () => {
    const result = formSchemaShape.safeParse({
      fields: [{ ...support, options: [support.options[0]] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a selection cap larger than the number of options', () => {
    const result = formSchemaShape.safeParse({
      fields: [{ ...support, maxSelections: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a selection cap within the options', () => {
    expect(
      formSchemaShape.safeParse({ fields: [{ ...support, maxSelections: 2 }] }).success,
    ).toBe(true);
  });
});

describe('validateAnswers: multi_select', () => {
  const schema = schemaWith(support);

  it('accepts several ticked options', () => {
    const result = validateAnswers(schema, { support_needed: ['goals', 'peer'] });
    expect(result.ok).toBe(true);
    expect(result.answers.support_needed).toEqual(['goals', 'peer']);
  });

  it('accepts a single ticked option, still as a list', () => {
    const result = validateAnswers(schema, { support_needed: ['peer'] });
    expect(result.answers.support_needed).toEqual(['peer']);
  });

  it('stores answers in the form\'s option order, not click order', () => {
    // Ticked last-to-first; stored first-to-last so submissions are comparable.
    const result = validateAnswers(schema, { support_needed: ['peer', 'goals', 'engagement'] });
    expect(result.answers.support_needed).toEqual(['engagement', 'goals', 'peer']);
  });

  it('de-duplicates repeated options', () => {
    const result = validateAnswers(schema, { support_needed: ['peer', 'peer'] });
    expect(result.answers.support_needed).toEqual(['peer']);
  });

  it('rejects an option the form does not offer', () => {
    const result = validateAnswers(schema, { support_needed: ['goals', 'a_pony'] });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.support_needed).toMatch(/available options/i);
  });

  it('treats nothing ticked as blank, which fails a required question', () => {
    const result = validateAnswers(schema, { support_needed: [] });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.support_needed).toMatch(/required/i);
  });

  it('allows nothing ticked on an optional question, stored as null', () => {
    const optional = schemaWith({ ...support, required: false });
    const result = validateAnswers(optional, { support_needed: [] });
    expect(result.ok).toBe(true);
    expect(result.answers.support_needed).toBeNull();
  });

  it('enforces the selection cap', () => {
    const capped = schemaWith({ ...support, maxSelections: 2 });
    const result = validateAnswers(capped, {
      support_needed: ['engagement', 'goals', 'peer'],
    });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.support_needed).toMatch(/at most 2/i);
  });

  it('accepts exactly the cap', () => {
    const capped = schemaWith({ ...support, maxSelections: 2 });
    expect(validateAnswers(capped, { support_needed: ['engagement', 'goals'] }).ok).toBe(true);
  });

  it('recovers a JSON-encoded list, so a stale draft is not lost', () => {
    const result = validateAnswers(schema, { support_needed: '["goals","peer"]' });
    expect(result.ok).toBe(true);
    expect(result.answers.support_needed).toEqual(['goals', 'peer']);
  });

  it('recovers a bare string, e.g. a draft written when the field was single-choice', () => {
    const result = validateAnswers(schema, { support_needed: 'peer' });
    expect(result.ok).toBe(true);
    expect(result.answers.support_needed).toEqual(['peer']);
  });

  it('rejects a list containing non-strings', () => {
    const result = validateAnswers(schema, { support_needed: ['goals', 42] });
    expect(result.ok).toBe(false);
  });

  it('rejects malformed JSON rather than treating it as an option', () => {
    const result = validateAnswers(schema, { support_needed: '["goals",' });
    expect(result.ok).toBe(false);
  });
});

describe('validateAnswers: multi_select alongside other field types', () => {
  it('validates a mixed form in one pass', () => {
    const schema = formSchemaShape.parse({
      fields: [
        support,
        {
          id: 'frequency',
          labelEn: 'How often do you meet?',
          labelFr: 'À quelle fréquence ?',
          type: 'single_select',
          required: true,
          options: [
            { value: 'weekly', labelEn: 'Weekly', labelFr: 'Hebdomadaire' },
            { value: 'monthly', labelEn: 'Monthly', labelFr: 'Mensuelle' },
          ],
        },
        {
          id: 'notes',
          labelEn: 'Notes',
          labelFr: 'Notes',
          type: 'long_text',
          required: false,
        },
      ],
    });

    const result = validateAnswers(schema, {
      support_needed: ['peer'],
      frequency: 'weekly',
      notes: '',
    });

    expect(result.ok).toBe(true);
    expect(result.answers).toEqual({
      support_needed: ['peer'],
      frequency: 'weekly',
      notes: null,
    });
  });

  it('does not let a single_select accept a list', () => {
    const schema = formSchemaShape.parse({
      fields: [
        {
          id: 'frequency',
          labelEn: 'How often?',
          labelFr: 'Fréquence ?',
          type: 'single_select',
          required: true,
          options: [
            { value: 'weekly', labelEn: 'Weekly', labelFr: 'Hebdomadaire' },
            { value: 'monthly', labelEn: 'Monthly', labelFr: 'Mensuelle' },
          ],
        },
      ],
    });
    expect(validateAnswers(schema, { frequency: ['weekly', 'monthly'] }).ok).toBe(false);
  });
});
