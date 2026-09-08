import { describe, expect, it } from 'vitest';
import { Language } from '@prisma/client';
import {
  DEFAULT_COHORT_LANGUAGES,
  cohortLanguages,
  isBilingual,
  offersLanguage,
  pickLanguageText,
  requiresFrench,
  soleLanguage,
} from '@/features/cohorts/languages';

// The single source of truth for "which languages does this cohort run in?".
// Everything downstream — the Forms Builder's French requirement, newsletter
// approval, the import validator — derives from these functions, so they get
// full coverage rather than a smoke test.

const EN_ONLY = { languages: [Language.EN] };
const FR_ONLY = { languages: [Language.FR] };
const BILINGUAL = { languages: [Language.EN, Language.FR] };

describe('cohortLanguages', () => {
  it('returns a bilingual cohort in canonical order', () => {
    expect(cohortLanguages(BILINGUAL)).toEqual([Language.EN, Language.FR]);
  });

  it('normalizes order regardless of how the array was stored', () => {
    expect(cohortLanguages({ languages: [Language.FR, Language.EN] })).toEqual([
      Language.EN,
      Language.FR,
    ]);
  });

  it('de-duplicates repeated entries', () => {
    expect(cohortLanguages({ languages: [Language.EN, Language.EN, Language.FR] })).toEqual([
      Language.EN,
      Language.FR,
    ]);
  });

  it('returns a single-language cohort as-is', () => {
    expect(cohortLanguages(EN_ONLY)).toEqual([Language.EN]);
    expect(cohortLanguages(FR_ONLY)).toEqual([Language.FR]);
  });

  // The two "unknown" cases resolve in opposite directions on purpose.
  it('falls back to the bilingual default when no cohort could be resolved', () => {
    expect(cohortLanguages(null)).toEqual([...DEFAULT_COHORT_LANGUAGES]);
    expect(cohortLanguages(undefined)).toEqual([...DEFAULT_COHORT_LANGUAGES]);
  });

  it('treats an explicitly empty array as English-only, not bilingual', () => {
    // A cohort claiming no languages must not end up *demanding* French text.
    expect(cohortLanguages({ languages: [] })).toEqual([Language.EN]);
    expect(requiresFrench({ languages: [] })).toBe(false);
  });

  it('never returns an empty list', () => {
    for (const cohort of [BILINGUAL, EN_ONLY, FR_ONLY, { languages: [] }, null, undefined]) {
      expect(cohortLanguages(cohort).length).toBeGreaterThan(0);
    }
  });

  it('does not alias the caller-visible array to a module constant', () => {
    // Guards against a mutation of one cohort's result leaking into the next.
    const first = cohortLanguages(null);
    first.pop();
    expect(cohortLanguages(null)).toEqual([...DEFAULT_COHORT_LANGUAGES]);
  });
});

describe('offersLanguage', () => {
  it('is true only for languages the cohort runs in', () => {
    expect(offersLanguage(EN_ONLY, Language.EN)).toBe(true);
    expect(offersLanguage(EN_ONLY, Language.FR)).toBe(false);
    expect(offersLanguage(FR_ONLY, Language.FR)).toBe(true);
    expect(offersLanguage(FR_ONLY, Language.EN)).toBe(false);
    expect(offersLanguage(BILINGUAL, Language.EN)).toBe(true);
    expect(offersLanguage(BILINGUAL, Language.FR)).toBe(true);
  });
});

describe('isBilingual', () => {
  it('is true only when more than one language is offered', () => {
    expect(isBilingual(BILINGUAL)).toBe(true);
    expect(isBilingual(EN_ONLY)).toBe(false);
    expect(isBilingual(FR_ONLY)).toBe(false);
  });

  it('is true for an unresolved cohort, preserving existing behaviour', () => {
    expect(isBilingual(null)).toBe(true);
  });
});

describe('requiresFrench', () => {
  it('only demands French from a cohort that offers it', () => {
    expect(requiresFrench(BILINGUAL)).toBe(true);
    expect(requiresFrench(FR_ONLY)).toBe(true);
    expect(requiresFrench(EN_ONLY)).toBe(false);
  });

  it('demands French when the cohort is unknown', () => {
    expect(requiresFrench(null)).toBe(true);
  });
});

describe('soleLanguage', () => {
  it('names the language when there is exactly one', () => {
    expect(soleLanguage(EN_ONLY)).toBe(Language.EN);
    expect(soleLanguage(FR_ONLY)).toBe(Language.FR);
  });

  it('is null when a choice is genuinely open', () => {
    expect(soleLanguage(BILINGUAL)).toBeNull();
    expect(soleLanguage(null)).toBeNull();
  });
});

describe('pickLanguageText', () => {
  it('prefers the requested language', () => {
    expect(pickLanguageText(Language.FR, { EN: 'Goal', FR: 'Objectif' })).toBe('Objectif');
    expect(pickLanguageText(Language.EN, { EN: 'Goal', FR: 'Objectif' })).toBe('Goal');
  });

  // The reason relaxing the French requirement is safe: a francophone reading an
  // English-only cohort's form sees English, never a blank label.
  it('falls back rather than rendering blank', () => {
    expect(pickLanguageText(Language.FR, { EN: 'Goal', FR: '' })).toBe('Goal');
    expect(pickLanguageText(Language.FR, { EN: 'Goal', FR: null })).toBe('Goal');
    expect(pickLanguageText(Language.FR, { EN: 'Goal' })).toBe('Goal');
    expect(pickLanguageText(Language.EN, { EN: '', FR: 'Objectif' })).toBe('Objectif');
  });

  it('treats whitespace-only text as absent', () => {
    expect(pickLanguageText(Language.FR, { EN: 'Goal', FR: '   ' })).toBe('Goal');
  });

  it('returns an empty string when neither language has text', () => {
    expect(pickLanguageText(Language.FR, { EN: '', FR: '' })).toBe('');
    expect(pickLanguageText(Language.EN, {})).toBe('');
  });
});
