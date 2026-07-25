/**
 * The FAQ index (PUBLIC_PAGES_MASTER_SPEC.md §7.2).
 *
 * Only the *structure* lives here — which questions exist, which category each
 * belongs to, and which are featured. The copy lives in
 * `messages/*.json` under `publicPages.faq.items`, so both locales stay in one
 * place and the parity test covers them.
 *
 * Every entry is answerable from shipped behaviour. Questions whose answer
 * would require a policy the product has not made are simply not asked here —
 * a plausible-sounding invented answer on a confidentiality-sensitive page is
 * worse than an absent one.
 */

export const FAQ_CATEGORIES = [
  'start',
  'access',
  'matching',
  'goals',
  'sessions',
  'private',
  'language',
  'privacy',
  'reviews',
  'support',
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export interface FaqEntry {
  /** Stable slug — the message key **and** the `/faq#q-<id>` deep link. */
  id: string;
  category: FaqCategory;
  /** Featured questions also appear in the short list above the full index. */
  featured?: boolean;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  { id: 'what-is', category: 'start' },
  { id: 'who-takes-part', category: 'start' },
  { id: 'how-long', category: 'start' },

  { id: 'get-account', category: 'access', featured: true },
  { id: 'invite-code', category: 'access' },
  { id: 'invite-problem', category: 'access' },
  { id: 'forgot-password', category: 'access' },
  { id: 'sso', category: 'access' },

  { id: 'matching-how', category: 'matching', featured: true },
  { id: 'matching-language', category: 'matching' },
  { id: 'matching-decline', category: 'matching', featured: true },
  { id: 'matching-after', category: 'matching' },

  { id: 'goal-submit', category: 'goals', featured: true },
  { id: 'goal-coach', category: 'goals' },

  { id: 'session-log', category: 'sessions' },
  { id: 'meetings', category: 'sessions' },

  { id: 'messages-private', category: 'private', featured: true },
  { id: 'journal-private', category: 'private' },

  { id: 'french', category: 'language', featured: true },
  { id: 'translate', category: 'language' },

  { id: 'admin-visibility', category: 'privacy' },

  { id: 'reviews', category: 'reviews' },
  { id: 'certificate', category: 'reviews' },

  { id: 'support-how', category: 'support' },
  { id: 'support-anonymous', category: 'support' },
];

/**
 * Fold accents and case so a French search for "reponse" finds "réponse", and
 * "É" matches "e". `NFD` splits each letter from its diacritic, and the Unicode
 * `Mark` property then removes the combining marks that are left behind —
 * written as a property escape rather than a literal U+0300–U+036F range so the
 * source file stays free of invisible combining characters.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}
