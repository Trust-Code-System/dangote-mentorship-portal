import { describe, expect, it } from 'vitest';
import {
  cleanRow,
  hasBlockingErrors,
  resolveRowLanguage,
  validateRow,
  validateRows,
  type CleanRow,
  type ValidationContext,
} from '@/features/imports/validation';

const NO_CONTEXT: ValidationContext = {
  targetRole: 'MENTOR',
  existingEmails: new Set(),
  seenEmailsInFile: new Set(),
};

function goodRow(overrides: Partial<CleanRow> = {}): CleanRow {
  return {
    fullName: 'Aisha Okafor',
    email: 'aisha.okafor@dangote.com',
    phone: '+2348012345678',
    language: 'EN',
    department: 'Cement',
    jobTitle: 'Senior Manager',
    location: 'Lagos',
    yearsExperience: 12,
    competencies: ['Leadership', 'Process Engineering'],
    careerGoals: '',
    whyText: 'Develop the next generation.',
    personality: 'Analytical',
    availability: 'Evenings',
    maxMentees: 3,
    ...overrides,
  };
}

// ── Header normalization / cleaning ─────────────────────────────────────────

describe('cleanRow', () => {
  it('maps common header variants onto canonical fields', () => {
    const clean = cleanRow({
      'Full Name': 'Chidi Eze',
      'E-mail': ' Chidi.Eze@Dangote.com ',
      'Preferred Language': 'English',
      Département: 'Sugar',
      'Job Title': 'Officer',
      'Years of Experience': '8 years',
      Competencies: 'Leadership; Communication, Data Analytics',
    });
    expect(clean.fullName).toBe('Chidi Eze');
    expect(clean.email).toBe('chidi.eze@dangote.com'); // trimmed + lowercased
    expect(clean.language).toBe('EN');
    expect(clean.department).toBe('Sugar');
    expect(clean.yearsExperience).toBe(8);
    expect(clean.competencies).toEqual(['Leadership', 'Communication', 'Data Analytics']);
  });

  it('parses French language labels', () => {
    expect(cleanRow({ Langue: 'Français' }).language).toBe('FR');
    expect(cleanRow({ Language: 'french' }).language).toBe('FR');
    expect(cleanRow({ Language: 'EN' }).language).toBe('EN');
    expect(cleanRow({ Language: 'Yoruba' }).language).toBe('');
  });

  it('extracts numbers from messy experience strings', () => {
    expect(cleanRow({ Experience: '20 years' }).yearsExperience).toBe(20);
    expect(cleanRow({ Experience: 'approx 7' }).yearsExperience).toBe(7);
    expect(cleanRow({ Experience: 'none' }).yearsExperience).toBeNull();
    expect(cleanRow({ Experience: '' }).yearsExperience).toBeNull();
  });

  it('ignores unknown headers without crashing', () => {
    const clean = cleanRow({ 'Favourite Colour': 'green', Email: 'a@b.co' });
    expect(clean.email).toBe('a@b.co');
  });
});

// ── Row validation golden cases (§11 example flags) ─────────────────────────

describe('validateRow golden cases', () => {
  it('a fully valid mentor row produces no findings', () => {
    expect(validateRow(goodRow(), NO_CONTEXT)).toEqual([]);
  });

  it('"This mentor has no language selected."', () => {
    const findings = validateRow(goodRow({ language: '' }), NO_CONTEXT);
    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_LANGUAGE',
        severity: 'ERROR',
        message: 'This mentor has no language selected.',
      }),
    );
  });

  // Cohort.languages = [EN]: there is only one answer a missing language could
  // have, so it is inferred rather than blocking the import (the FR half of the
  // portal is switched off for this cohort, not removed from the product).
  it('does not flag a missing language for a single-language cohort', () => {
    const findings = validateRow(goodRow({ language: '' }), {
      ...NO_CONTEXT,
      soleLanguage: 'EN',
    });
    expect(findings.map((f) => f.code)).not.toContain('MISSING_LANGUAGE');
  });

  it('still flags a missing language for a bilingual cohort', () => {
    const findings = validateRow(goodRow({ language: '' }), {
      ...NO_CONTEXT,
      soleLanguage: null,
    });
    expect(findings.map((f) => f.code)).toContain('MISSING_LANGUAGE');
  });

  it('an inferred language does not stop a blank row reading as incomplete', () => {
    const findings = validateRow(
      goodRow({
        language: '',
        department: '',
        jobTitle: '',
        careerGoals: '',
        whyText: '',
        fullName: '',
      }),
      { ...NO_CONTEXT, soleLanguage: 'EN' },
    );
    expect(findings.map((f) => f.code)).toContain('INCOMPLETE_RESPONSE');
  });

  it('"This mentee has no career goal."', () => {
    const findings = validateRow(goodRow({ careerGoals: '' }), {
      ...NO_CONTEXT,
      targetRole: 'MENTEE',
    });
    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_CAREER_GOAL',
        message: 'This mentee has no career goal.',
      }),
    );
  });

  it('"20 years\' experience but no competency area selected."', () => {
    const findings = validateRow(
      goodRow({ yearsExperience: 20, competencies: [] }),
      NO_CONTEXT,
    );
    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'EXPERIENCE_NO_COMPETENCY',
        message: "20 years' experience but no competency area selected.",
      }),
    );
  });

  it('missing name is a blocking error', () => {
    const findings = validateRow(goodRow({ fullName: '' }), NO_CONTEXT);
    expect(findings).toContainEqual(expect.objectContaining({ code: 'MISSING_NAME', severity: 'ERROR' }));
    expect(hasBlockingErrors(findings)).toBe(true);
  });

  it('missing email is a blocking error', () => {
    const findings = validateRow(goodRow({ email: '' }), NO_CONTEXT);
    expect(findings).toContainEqual(expect.objectContaining({ code: 'MISSING_EMAIL', severity: 'ERROR' }));
  });

  it('invalid email shapes are caught', () => {
    for (const bad of ['paul(at)dangote.com', 'paul@', 'paul@dangote', 'pau l@dangote.com']) {
      const findings = validateRow(goodRow({ email: bad }), NO_CONTEXT);
      expect(findings, bad).toContainEqual(expect.objectContaining({ code: 'INVALID_EMAIL' }));
    }
  });

  it('duplicate against existing cohort members is flagged', () => {
    const findings = validateRow(goodRow(), {
      ...NO_CONTEXT,
      existingEmails: new Set(['aisha.okafor@dangote.com']),
    });
    expect(findings).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_EXISTING' }));
  });

  it('mostly-empty rows are flagged as incomplete responses', () => {
    const findings = validateRow(
      goodRow({
        fullName: '', email: '', language: '', department: '', jobTitle: '',
        careerGoals: '', whyText: '', competencies: [], yearsExperience: null,
      }),
      NO_CONTEXT,
    );
    expect(findings).toContainEqual(expect.objectContaining({ code: 'INCOMPLETE_RESPONSE' }));
  });

  it('warnings alone do not block committing', () => {
    const findings = validateRow(goodRow({ department: '' }), NO_CONTEXT);
    expect(findings).toContainEqual(expect.objectContaining({ code: 'MISSING_DEPARTMENT', severity: 'WARNING' }));
    expect(hasBlockingErrors(findings)).toBe(false);
  });
});

// ── Whole-file validation (duplicates in-file, ordering) ────────────────────

describe('validateRows', () => {
  it('flags the second occurrence of a duplicated email, not the first', () => {
    const results = validateRows(
      [
        { 'Full Name': 'A One', Email: 'dup@dangote.com', Language: 'EN', Department: 'IT', 'Job Title': 'Mgr', Competencies: 'Leadership', Experience: '10' },
        { 'Full Name': 'A Two', Email: 'dup@dangote.com', Language: 'EN', Department: 'IT', 'Job Title': 'Mgr', Competencies: 'Leadership', Experience: '10' },
      ],
      { targetRole: 'MENTOR', existingEmails: new Set() },
    );
    expect(results[0]!.findings.find((f) => f.code === 'DUPLICATE_IN_FILE')).toBeUndefined();
    expect(results[1]!.findings).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_IN_FILE' }));
  });

  it('handles the M0 seeded messy rows exactly as the spec describes', () => {
    const messyRows = [
      { 'Full Name': 'Grace Eze', Email: '', Language: 'EN', Department: 'Cement' },
      { 'Full Name': 'Paul Adeyemi', Email: 'paul(at)dangote.com', Language: '', Department: 'Sugar' },
      { 'Full Name': 'Aisha Eze', Email: 'mentor.aisha.eze.0@dangote.com', Language: 'EN', Department: 'Cement' },
      { 'Full Name': 'Sani Bello', Email: 'sani.bello@dangote.com', Language: 'FR', Department: '', Experience: '20 years', Competencies: '' },
      { 'Full Name': '', Email: 'unknown@dangote.com', Language: 'EN', Department: 'Logistics' },
    ];
    const results = validateRows(messyRows, {
      targetRole: 'MENTOR',
      existingEmails: new Set(['mentor.aisha.eze.0@dangote.com']),
    });

    expect(results[0]!.findings).toContainEqual(expect.objectContaining({ code: 'MISSING_EMAIL' }));
    expect(results[1]!.findings).toContainEqual(expect.objectContaining({ code: 'INVALID_EMAIL' }));
    expect(results[1]!.findings).toContainEqual(expect.objectContaining({ code: 'MISSING_LANGUAGE' }));
    expect(results[2]!.findings).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_EXISTING' }));
    expect(results[3]!.findings).toContainEqual(expect.objectContaining({ code: 'EXPERIENCE_NO_COMPETENCY' }));
    expect(results[3]!.findings).toContainEqual(expect.objectContaining({ code: 'MISSING_DEPARTMENT' }));
    expect(results[4]!.findings).toContainEqual(expect.objectContaining({ code: 'MISSING_NAME' }));
  });
});

// The commit path must record the same language the validator judged the row
// against, or a row that passed without a language would be silently written as
// English inside a French-only cohort.
describe('resolveRowLanguage', () => {
  it('prefers what the file said', () => {
    expect(resolveRowLanguage('FR', 'EN')).toBe('FR');
    expect(resolveRowLanguage('EN', 'FR')).toBe('EN');
  });

  it("infers the cohort's sole language when the row has none", () => {
    expect(resolveRowLanguage('', 'FR')).toBe('FR');
    expect(resolveRowLanguage('', 'EN')).toBe('EN');
  });

  it('falls back to English for a bilingual cohort', () => {
    expect(resolveRowLanguage('', null)).toBe('EN');
    expect(resolveRowLanguage('')).toBe('EN');
  });
});
