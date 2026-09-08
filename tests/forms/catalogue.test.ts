import { describe, expect, it } from 'vitest';
import { ReviewType, RoleName } from '@prisma/client';
import { STANDARD_FORMS, validateStandardForm } from '@/features/forms/catalogue';
import { formSchemaShape } from '@/features/forms/schema';

// The catalogue is the single source of truth for the question sets transcribed
// from the programme's documents. A typo here reaches every cohort an admin sets
// up, so it is validated against the live form contract at build time rather
// than discovered when the installer fails.

describe('standard form catalogue', () => {
  it('contains the three recurring sets', () => {
    expect(STANDARD_FORMS).toHaveLength(3);
    expect(STANDARD_FORMS.map((f) => `${f.type}/${f.roleName}`)).toEqual([
      `${ReviewType.QUARTERLY}/${RoleName.MENTEE}`,
      `${ReviewType.QUARTERLY}/${RoleName.MENTOR}`,
      `${ReviewType.MONTHLY}/${RoleName.MENTEE}`,
    ]);
  });

  it.each(STANDARD_FORMS.map((f) => [`${f.type}/${f.roleName}`, f] as const))(
    'validates %s against the live form contract',
    (_label, form) => {
      const result = validateStandardForm(form);
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
    },
  );

  it.each(STANDARD_FORMS.map((f) => [`${f.type}/${f.roleName}`, f] as const))(
    '%s is fully bilingual',
    (_label, form) => {
      for (const field of form.fields) {
        expect(field.labelEn.trim(), `EN label for ${field.id}`).not.toBe('');
        expect(field.labelFr.trim(), `FR label for ${field.id}`).not.toBe('');
        for (const option of field.options ?? []) {
          expect(option.labelEn.trim(), `EN option ${option.value}`).not.toBe('');
          expect(option.labelFr.trim(), `FR option ${option.value}`).not.toBe('');
        }
      }
    },
  );

  it.each(STANDARD_FORMS.map((f) => [`${f.type}/${f.roleName}`, f] as const))(
    '%s has unique field ids',
    (_label, form) => {
      const ids = form.fields.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it('never targets a role that does not answer the form', () => {
    // The monthly meeting form is a mentee obligation; a mentor set would be
    // published but never served, which is worse than absent.
    const monthly = STANDARD_FORMS.filter((f) => f.type === ReviewType.MONTHLY);
    expect(monthly.every((f) => f.roleName === RoleName.MENTEE)).toBe(true);
  });

  it('gives every set a title an admin can recognise', () => {
    for (const form of STANDARD_FORMS) {
      expect(form.title.length).toBeGreaterThan(4);
      expect(form.title.length).toBeLessThanOrEqual(200);
    }
  });
});

// Spot-checks against the source documents. These are the answers a wrong
// transcription would silently change, so they are asserted by value.
describe('transcription fidelity', () => {
  const bySet = (type: ReviewType, role: RoleName) =>
    STANDARD_FORMS.find((f) => f.type === type && f.roleName === role)!;

  it('the mentee assessment offers the four progress options from the document', () => {
    const field = bySet(ReviewType.QUARTERLY, RoleName.MENTEE).fields.find(
      (f) => f.id === 'goal_progress',
    );
    expect(field?.options?.map((o) => o.value)).toEqual([
      'significant',
      'some',
      'limited',
      'none',
    ]);
  });

  it('the mentee assessment lets several difficulties be ticked', () => {
    const field = bySet(ReviewType.QUARTERLY, RoleName.MENTEE).fields.find(
      (f) => f.id === 'difficulties',
    );
    expect(field?.type).toBe('multi_select');
    expect(field?.options?.map((o) => o.value)).toContain('time');
  });

  it('the mentor assessment asks about mentee engagement on a four-point scale', () => {
    const field = bySet(ReviewType.QUARTERLY, RoleName.MENTOR).fields.find(
      (f) => f.id === 'mentee_engagement',
    );
    expect(field?.options).toHaveLength(4);
  });

  it('the mentor assessment keeps the challenges yes/no plus a description', () => {
    const mentor = bySet(ReviewType.QUARTERLY, RoleName.MENTOR);
    expect(mentor.fields.find((f) => f.id === 'had_challenges')?.type).toBe('boolean');
    expect(mentor.fields.find((f) => f.id === 'challenges_detail')?.required).toBe(false);
  });

  it('the monthly form keeps the three action slots, first required', () => {
    const monthly = bySet(ReviewType.MONTHLY, RoleName.MENTEE);
    expect(monthly.fields.find((f) => f.id === 'action_1')?.required).toBe(true);
    expect(monthly.fields.find((f) => f.id === 'action_2')?.required).toBe(false);
    expect(monthly.fields.find((f) => f.id === 'action_3')?.required).toBe(false);
  });

  it('the monthly form keeps the terms affirmation as a required tick', () => {
    const field = bySet(ReviewType.MONTHLY, RoleName.MENTEE).fields.find(
      (f) => f.id === 'terms_agreed',
    );
    expect(field?.type).toBe('boolean');
    expect(field?.required).toBe(true);
  });

  it('does not ask anyone to retype their name, email or batch', () => {
    // Identity comes from the signed-in account; asking again adds friction and
    // a chance to mistype (a decision recorded with the owner).
    for (const form of STANDARD_FORMS) {
      const ids = form.fields.map((f) => f.id);
      expect(ids).not.toContain('full_name');
      expect(ids).not.toContain('email');
      expect(ids).not.toContain('batch');
    }
  });

  it('parses through the same schema the Forms Builder saves with', () => {
    for (const form of STANDARD_FORMS) {
      expect(formSchemaShape.safeParse({ fields: form.fields }).success).toBe(true);
    }
  });
});
