import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import { FAQ_CATEGORIES, FAQ_ENTRIES, normalizeForSearch } from '@/app/(pages)/faq/faq-data';

/**
 * Guards for the public Knowledge Library (/about, /faq, /confidentiality,
 * /contact).
 *
 * The pages read their copy from `publicPages.*`, and the FAQ's *structure*
 * lives in `faq-data.ts` while its *content* lives in the message catalogues.
 * These tests are what stop the two halves drifting: an entry added to the
 * index without copy, or copy added in English and forgotten in French, fails
 * here rather than rendering a raw message key to a visitor.
 */

type Json = Record<string, unknown>;

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

function read(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as Json)?.[key], tree);
}

const enPublic = (en as Json).publicPages;
const frPublic = (fr as Json).publicPages;

describe('public pages copy', () => {
  it('exists in both locales', () => {
    expect(enPublic).toBeTypeOf('object');
    expect(frPublic).toBeTypeOf('object');
  });

  it('has exactly the same keys in English and French', () => {
    const enKeys = leafPaths(enPublic).sort();
    const frKeys = leafPaths(frPublic).sort();

    expect(
      enKeys.filter((key) => !frKeys.includes(key)),
      'keys missing from messages/fr.json',
    ).toEqual([]);
    expect(
      frKeys.filter((key) => !enKeys.includes(key)),
      'keys missing from messages/en.json',
    ).toEqual([]);
  });

  it('has no empty or placeholder strings in either locale', () => {
    for (const [name, tree] of [
      ['en', enPublic],
      ['fr', frPublic],
    ] as const) {
      for (const value of leafValues(tree)) {
        expect(value.trim(), `empty string in ${name}`).not.toBe('');
        expect(value, `untranslated placeholder in ${name}`).not.toMatch(/^TODO|lorem ipsum/i);
      }
    }
  });

  it('is genuinely translated — French is not a copy of English', () => {
    // The bilingual section shows both languages side by side on purpose, and
    // a few labels are the same word in both languages.
    const intentionallyShared = new Set([
      'about.bilingual.enLabel',
      'about.bilingual.frLabel',
      'about.bilingual.sampleEn',
      'about.bilingual.sampleFr',
      'faq.hero.breadcrumb',
      'faq.categories.faq',
      'shared.home',
    ]);

    const identical = leafPaths(enPublic).filter((path) => {
      if (intentionallyShared.has(path)) return false;
      return read(enPublic, path) === read(frPublic, path);
    });

    expect(identical, 'French strings identical to English').toEqual([]);
  });

  it('does not publish unverified participation figures', () => {
    // Same guard as the landing page: "120+" / "300+" are planning figures from
    // the brief, not live data, and must not appear on a public page.
    for (const tree of [enPublic, frPublic]) {
      for (const value of leafValues(tree)) {
        expect(value).not.toMatch(/\b\d{2,}\s*\+/);
      }
    }
  });
});

describe('FAQ index', () => {
  it('has copy for every indexed question, in both locales', () => {
    for (const [name, tree] of [
      ['en', enPublic],
      ['fr', frPublic],
    ] as const) {
      for (const entry of FAQ_ENTRIES) {
        const question = read(tree, `faq.items.${entry.id}.q`);
        const answer = read(tree, `faq.items.${entry.id}.a`);
        expect(question, `${name}: missing question for "${entry.id}"`).toBeTypeOf('string');
        expect(answer, `${name}: missing answer for "${entry.id}"`).toBeTypeOf('string');
      }
    }
  });

  it('has no orphaned copy for questions that are not indexed', () => {
    const indexed = new Set(FAQ_ENTRIES.map((entry) => entry.id));
    const written = Object.keys(read(enPublic, 'faq.items') as Json);
    expect(written.filter((id) => !indexed.has(id))).toEqual([]);
  });

  it('uses unique question ids', () => {
    const ids = FAQ_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every question to a known category, and labels every category', () => {
    for (const entry of FAQ_ENTRIES) {
      expect(FAQ_CATEGORIES, `unknown category on "${entry.id}"`).toContain(entry.category);
    }
    for (const category of FAQ_CATEGORIES) {
      for (const tree of [enPublic, frPublic]) {
        expect(read(tree, `faq.categories.${category}`)).toBeTypeOf('string');
      }
    }
  });

  it('leaves no category empty', () => {
    const used = new Set(FAQ_ENTRIES.map((entry) => entry.category));
    expect(FAQ_CATEGORIES.filter((category) => !used.has(category))).toEqual([]);
  });

  it('features a useful handful of questions, not all of them', () => {
    const featured = FAQ_ENTRIES.filter((entry) => entry.featured);
    expect(featured.length).toBeGreaterThanOrEqual(4);
    expect(featured.length).toBeLessThanOrEqual(8);
  });
});

describe('FAQ search normalisation', () => {
  it('folds case', () => {
    expect(normalizeForSearch('Matching')).toBe('matching');
  });

  it('folds French accents so an unaccented query still matches', () => {
    expect(normalizeForSearch('réponse')).toBe(normalizeForSearch('reponse'));
    expect(normalizeForSearch('Étape')).toBe('etape');
    expect(normalizeForSearch('mentoré')).toBe('mentore');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeForSearch('  objectifs  ')).toBe('objectifs');
  });

  it('finds an accented answer from an unaccented query', () => {
    // The French answer contains "règle stricte"; a reader typing "regle"
    // without the grave accent must still reach it.
    const answer = read(frPublic, 'faq.items.matching-language.a') as string;
    expect(answer).toContain('règle');
    expect(normalizeForSearch(answer)).toContain(normalizeForSearch('règle stricte'));
  });
});
