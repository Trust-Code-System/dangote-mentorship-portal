import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import { DEFAULT_WEIGHTS } from '@/features/matching/engine';

/**
 * Guards for the public landing page.
 *
 * The landing page restates facts that live elsewhere in the application — the
 * nine journey stages, the matching weights, the fact that language is a hard
 * rule. Those are duplicated deliberately (a public marketing page must not
 * import server matching code into the client bundle), so these tests are what
 * stop the duplication from silently drifting into a lie.
 */

type Json = Record<string, unknown>;

/** Every leaf key path in an object, e.g. `hero.line1`. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as Json).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function leafValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  return Object.values(value as Json).flatMap(leafValues);
}

const enLanding = (en as Json).landing;
const frLanding = (fr as Json).landing;

describe('landing copy', () => {
  it('exists in both locales', () => {
    expect(enLanding).toBeTypeOf('object');
    expect(frLanding).toBeTypeOf('object');
  });

  it('has exactly the same keys in English and French', () => {
    const enKeys = leafPaths(enLanding).sort();
    const frKeys = leafPaths(frLanding).sort();

    // Reported as explicit diffs so a failure names the missing key rather than
    // dumping two large arrays.
    const missingInFr = enKeys.filter((key) => !frKeys.includes(key));
    const missingInEn = frKeys.filter((key) => !enKeys.includes(key));

    expect(missingInFr, 'keys missing from messages/fr.json').toEqual([]);
    expect(missingInEn, 'keys missing from messages/en.json').toEqual([]);
  });

  it('has no empty or placeholder strings in either locale', () => {
    for (const [name, tree] of [
      ['en', enLanding],
      ['fr', frLanding],
    ] as const) {
      for (const value of leafValues(tree)) {
        expect(value.trim(), `empty string in ${name}`).not.toBe('');
        expect(value, `untranslated placeholder in ${name}`).not.toMatch(/^TODO|lorem ipsum/i);
      }
    }
  });

  it('is genuinely translated — French is not a copy of English', () => {
    // A handful of strings are intentionally identical in both files: the
    // bilingual sample (which shows both languages side by side on purpose),
    // the language labels, the numeric facts, and words that are simply the
    // same in English and French — "Menu", "Mentor", "Mentors", "Ambition",
    // "Programme". Everything else must differ.
    const intentionallyShared = new Set([
      'bilingual.sampleEn',
      'bilingual.sampleFr',
      'bilingual.enLabel',
      'bilingual.frLabel',
      'matching.languageEn',
      'matching.languageFr',
      'nav.faq',
      'footer.faq',
      'nav.programme',
      'principles.facts.monthsValue',
      'principles.facts.stagesValue',
      'principles.facts.languagesValue',
      'principles.facts.criteriaValue',
      'principles.facts.rolesValue',
      'principles.facts.hardRuleValue',
      // Cognates — identical in both languages by definition, not by omission.
      'nav.menuTitle',
      'hero.mentorLabel',
      'problem.ambitionLabel',
      'matching.mentorsLabel',
      'footer.sectionsLabel',
    ]);

    const identical = leafPaths(enLanding).filter((path) => {
      if (intentionallyShared.has(path)) return false;
      const read = (tree: unknown) =>
        path.split('.').reduce<unknown>((node, key) => (node as Json)?.[key], tree);
      return read(enLanding) === read(frLanding);
    });

    expect(identical, 'French strings identical to English').toEqual([]);
  });
});

describe('landing facts match the application', () => {
  const STAGES = [
    'profile',
    'training',
    'matched',
    'agreement',
    'goals',
    'sessions',
    'midterm',
    'final',
    'certificate',
  ];

  it('lists the same nine journey stages the portal uses', () => {
    // The authenticated journey rail is driven by `home.journey.nodes`.
    const portalStages = Object.keys(((en as Json).home as Json).journey as Json).includes('nodes')
      ? Object.keys((((en as Json).home as Json).journey as Json).nodes as Json)
      : [];

    expect(portalStages).toEqual(STAGES);

    for (const locale of [enLanding, frLanding]) {
      const landingStages = Object.keys(((locale as Json).journey as Json).stages as Json);
      expect(landingStages).toEqual(STAGES);
    }
  });

  it('states a stage count that matches the number of stages', () => {
    for (const locale of [enLanding, frLanding]) {
      const facts = ((locale as Json).principles as Json).facts as Json;
      expect(Number(facts.stagesValue)).toBe(STAGES.length);
    }
  });

  it('states a criteria count that matches the real matching engine', () => {
    const weightCount = Object.keys(DEFAULT_WEIGHTS).length;

    for (const locale of [enLanding, frLanding]) {
      const facts = ((locale as Json).principles as Json).facts as Json;
      expect(Number(facts.criteriaValue)).toBe(weightCount);
    }
  });

  it('names every matching criterion the engine scores on', () => {
    for (const locale of [enLanding, frLanding]) {
      const criteria = ((locale as Json).matching as Json).criteria as Json;
      expect(Object.keys(criteria).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort());
    }
  });

  it('does not publish unverified participation figures', () => {
    // "120+" / "300+" are planning figures from the project brief, not live
    // data. They were removed from the landing page pending owner confirmation
    // (LANDING_PAGE_MASTER_SPEC.md §12) and must not creep back in.
    for (const tree of [enLanding, frLanding]) {
      for (const value of leafValues(tree)) {
        expect(value).not.toMatch(/\b\d{2,}\s*\+/);
      }
    }
  });
});
