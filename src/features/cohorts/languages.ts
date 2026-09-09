import { Language } from '@prisma/client';

// ──────────────────────────────────────────────────────────────────────────
// Which languages a cohort actually operates in (pure — no I/O, unit tested).
//
// `Cohort.languages` has been storable and admin-editable since M0, but nothing
// read it: every screen demanded EN *and* FR unconditionally. For a cohort with
// no French participants that means an admin inventing French text for a form
// nobody will ever read in French, and participants staring at empty French
// boxes. So the decision lives here, once, rather than as an
// `includes('FR')` sprinkled through twenty components.
//
// The distinction this file is careful about (CLAUDE.md §16 — "don't force
// French users into English anywhere"):
//
//   ✅ A cohort without FR stops *demanding* French content and stops offering
//      French affordances that would be empty.
//   ❌ It never strips French from a cohort that has it, never touches stored
//      `labelFr` / `bodyFr` / `subjectFr` text, and never stops a francophone
//      reading the *interface* in French — that is a personal preference served
//      by the locale switcher, which is deliberately not cohort-scoped.
//
// So "French off" means "this cohort has no French participants", never
// "French is unsupported". Ticking FR back on restores the bilingual behaviour
// exactly, because nothing here writes or clears data.
//
// Deliberately NOT gated on this setting, because each is about a *person's*
// authored content rather than the cohort's operating language:
//
//   - the content translate toggle (components/translate-toggle.tsx);
//   - "what language did you write this in?" on journal entries and notes;
//   - the certificate's EN/FR rendering, which is complete in both languages.
//
// The authenticated participant locale switcher *is* cohort-scoped: an EN-only
// participant does not see a French button, while public and admin surfaces stay
// bilingual. Only programme authoring demands and participant chrome belong to
// this setting; stored content and translation tools are never removed.
// ──────────────────────────────────────────────────────────────────────────

/** Canonical display/iteration order. EN first — it is the guaranteed fallback. */
export const LANGUAGE_ORDER: readonly Language[] = [Language.EN, Language.FR];

/**
 * What a cohort offers when we don't know. Mirrors the Prisma default
 * (`@default([EN, FR])`): an unresolved cohort behaves exactly as the portal did
 * before this setting was wired up, so "we couldn't tell" never silently hides
 * French from someone.
 */
export const DEFAULT_COHORT_LANGUAGES: readonly Language[] = [Language.EN, Language.FR];

/** The minimum a cohort can operate in. See `cohortLanguages` on why EN. */
export const FALLBACK_COHORT_LANGUAGES: readonly Language[] = [Language.EN];

/** The shape this module needs — anything carrying a `languages` array. */
export interface CohortLanguageSource {
  languages: Language[];
}

/**
 * The languages `cohort` operates in, normalized: de-duplicated and in
 * `LANGUAGE_ORDER`.
 *
 * Two different "unknown" cases, deliberately resolved in opposite directions:
 *
 *   - `null` / `undefined` — the caller could not resolve a cohort (a user with
 *     no profile yet, a pre-login screen). Returns the bilingual default, i.e.
 *     "change nothing".
 *   - a recorded but *empty* array — a data anomaly the Zod schema's `.min(1)`
 *     is supposed to prevent. Returns `[EN]`, because EN is the only language
 *     guaranteed to have content: `labelEn` and `subjectEn` are always required
 *     and every render path falls back to English. Treating it as bilingual
 *     instead would demand French text for a cohort that claims no languages
 *     at all — the exact failure this module exists to remove.
 */
export function cohortLanguages(cohort: CohortLanguageSource | null | undefined): Language[] {
  if (!cohort) return [...DEFAULT_COHORT_LANGUAGES];
  const offered = LANGUAGE_ORDER.filter((language) => cohort.languages.includes(language));
  return offered.length > 0 ? offered : [...FALLBACK_COHORT_LANGUAGES];
}

/** True when `cohort` operates in `language`. */
export function offersLanguage(
  cohort: CohortLanguageSource | null | undefined,
  language: Language,
): boolean {
  return cohortLanguages(cohort).includes(language);
}

/** True when `cohort` runs in more than one language. */
export function isBilingual(cohort: CohortLanguageSource | null | undefined): boolean {
  return cohortLanguages(cohort).length > 1;
}

/**
 * True when authored content for `cohort` must carry French.
 *
 * This is the gate on *demanding* French: the Forms Builder's `labelFr`, the
 * newsletter's `subjectFr`. It never gates reading or displaying French that is
 * already stored.
 */
export function requiresFrench(cohort: CohortLanguageSource | null | undefined): boolean {
  return offersLanguage(cohort, Language.FR);
}

/**
 * The one language `cohort` runs in, or null when it runs in several.
 *
 * Use it where a language *choice* is meaningless — the "what language am I
 * writing in?" picker, an import row with no language column — so the single
 * answer can be applied silently instead of asked for.
 */
export function soleLanguage(cohort: CohortLanguageSource | null | undefined): Language | null {
  const offered = cohortLanguages(cohort);
  return offered.length === 1 ? (offered[0] ?? null) : null;
}

/**
 * Pick the best available text for `language`, falling back to the other
 * language rather than rendering blank.
 *
 * This is what makes relaxing the French requirement safe. Existing renderers
 * did `lang === 'FR' ? labelFr : labelEn`, which shows an empty label to a
 * French-locale reader the moment `labelFr` is allowed to be empty — and a
 * francophone admin reading an English-only cohort's form is a real case.
 * Falling back is always better than a blank.
 */
export function pickLanguageText(
  language: Language,
  text: { EN?: string | null; FR?: string | null },
): string {
  const preferred = language === Language.FR ? text.FR : text.EN;
  if (preferred && preferred.trim() !== '') return preferred;
  const other = language === Language.FR ? text.EN : text.FR;
  return other && other.trim() !== '' ? other : '';
}
