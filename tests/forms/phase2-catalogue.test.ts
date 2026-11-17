import { describe, it, expect } from 'vitest';
import { PHASE2_FORMS, phase2MonthlyForm } from '@/features/forms/phase2-catalogue';
import { formSchemaShape } from '@/features/forms/schema';
import { aggregateAnswers } from '@/features/reviews/aggregate';
import { validateAnswers } from '@/features/reviews/schema';
import { formFieldMetadata, protectPrivateFields } from '@/features/forms/metadata';

describe('2026/2027 document fidelity and privacy', () => {
  it.each([
    ['C1', 29, 62],
    ['C2', 31, 64],
    ['D1', 27, 60],
    ['D2', 25, 52],
  ])('preserves every numbered question and table row in %s', (code, questions, count) => {
    const form = PHASE2_FORMS.find((f) => f.code === code)!;
    expect(formSchemaShape.safeParse(form.schema).success).toBe(true);
    expect(form.schema.fields).toHaveLength(Number(count));
    expect(
      new Set(form.schema.fields.flatMap((f) => (f.sourceQuestion ? [f.sourceQuestion] : []))).size,
    ).toBe(Number(questions));
    expect(form.schema.fields.some((f) => f.declaration)).toBe(true);
    expect(JSON.stringify(form.schema)).not.toMatch(
      /Note for reviewers|Next steps once approved|Prepared by:|Draft 1, 13 November/,
    );
  });
  it('never aggregates confidential answers or identity fields, including counts', () => {
    for (const form of PHASE2_FORMS) {
      const aggregates = aggregateAnswers(form.schema.fields, []);
      const excluded = form.schema.fields.filter((f) => f.confidential || f.reporting === false);
      expect(excluded.length).toBeGreaterThan(0);
      for (const field of excluded)
        expect(aggregates.some((a) => a.fieldId === field.id)).toBe(false);
    }
  });
  it('preserves privacy and source metadata through editing and blocks privacy downgrade', () => {
    const field = PHASE2_FORMS[0]!.schema.fields.find((f) => f.confidential)!;
    expect(formFieldMetadata(field).confidential).toBe(true);
    const edited = { ...field, labelEn: 'Updated wording', confidential: false, reporting: true };
    expect(protectPrivateFields([edited], [field])[0]).toMatchObject({
      confidential: true,
      reporting: false,
      labelEn: 'Updated wording',
    });
  });
  it('requires an affirmative declaration and validates calendar dates', () => {
    const fields = PHASE2_FORMS[0]!.schema.fields;
    const declaration = fields.find((f) => f.declaration)!;
    expect(validateAnswers({ fields: [declaration] }, { [declaration.id]: 'false' }).ok).toBe(
      false,
    );
    expect(validateAnswers({ fields: [declaration] }, { [declaration.id]: 'true' }).ok).toBe(true);
    const date = fields.find((f) => f.inputType === 'date')!;
    expect(validateAnswers({ fields: [date] }, { [date.id]: '2026-02-30' }).ok).toBe(false);
    expect(validateAnswers({ fields: [date] }, { [date.id]: '2026-11-16' }).ok).toBe(true);
  });
  it('retains the existing monthly question set without inventing a new source', () => {
    expect(phase2MonthlyForm().schema.fields).toHaveLength(13);
    expect(phase2MonthlyForm().schema.fields.every((f) => f.labelFr === '')).toBe(true);
  });
});
