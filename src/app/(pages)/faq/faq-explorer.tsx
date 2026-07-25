'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { PublicAccordion, type AccordionItemModel } from '@/components/public/public-accordion';
import { normalizeForSearch, type FaqCategory } from './faq-data';
import { cn } from '@/lib/utils';

export interface FaqExplorerItem extends AccordionItemModel {
  category: FaqCategory;
  categoryLabel: string;
}

/**
 * Search + category filtering over the FAQ (PUBLIC_PAGES_MASTER_SPEC.md §7.2).
 *
 * Entirely client-side. The whole index is a few kilobytes of text that the
 * server has already rendered, so a keystroke that triggers a network round
 * trip would be slower, not smarter — and searching a help page should keep
 * working on a bad connection.
 *
 * Decisions worth naming:
 *
 *  - **Search and category are independent.** Typing does not reset the chosen
 *    category and choosing a category does not clear the search box, which is
 *    the single most common annoyance in filter UIs.
 *  - **Search covers question, answer *and* category name**, so "privacy" finds
 *    the privacy category's questions even when the word is not in their text.
 *  - **Accents are folded** (`normalizeForSearch`), so a French reader typing
 *    without accents still finds accented copy.
 *  - **The result count is announced.** An `aria-live="polite"` region reports
 *    how many questions match, because a sighted user sees the list shrink and
 *    a screen-reader user otherwise gets nothing at all.
 */
export function FaqExplorer({
  items,
  categories,
}: {
  items: FaqExplorerItem[];
  categories: { id: FaqCategory; label: string }[];
}) {
  const t = useTranslations('publicPages.faq.search');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = normalizeForSearch(query);
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!needle) return true;
      const haystack = normalizeForSearch(
        `${item.question} ${item.answer} ${item.categoryLabel}`,
      );
      return haystack.includes(needle);
    });
  }, [items, query, category]);

  // Only offer categories that still contain something under the current
  // search — a filter chip that guarantees an empty list is a dead control.
  const availableCategories = useMemo(() => {
    const needle = normalizeForSearch(query);
    if (!needle) return categories;
    const present = new Set(
      items
        .filter((item) =>
          normalizeForSearch(`${item.question} ${item.answer} ${item.categoryLabel}`).includes(
            needle,
          ),
        )
        .map((item) => item.category),
    );
    return categories.filter((entry) => present.has(entry.id));
  }, [categories, items, query]);

  function reset() {
    setQuery('');
    setCategory('all');
    inputRef.current?.focus();
  }

  const countMessage =
    filtered.length === 0
      ? t('resultsNone')
      : filtered.length === 1
        ? t('resultsOne')
        : t('resultsMany', { count: filtered.length });

  return (
    // Help-centre layout: the controls become a rail on the left from `lg`,
    // and the answers take the remaining width. Below `lg` they simply stack,
    // which is the right order — you search, then you read.
    <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
      <div className="lg:sticky lg:top-28 lg:self-start">
        {/* ── Search ── */}
        <div className="relative">
          <label htmlFor="faq-search" className="sr-only">
            {t('label')}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-blak-text-2"
          />
          <input
            id="faq-search"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('placeholder')}
            autoComplete="off"
            className="h-14 w-full rounded-full border border-blak-border/15 bg-blak-black/50 pl-14 pr-14 text-base text-blak-text placeholder:text-blak-text-2/70 focus:border-blak-green/50"
          />
          {query ? (
            <button
              type="button"
              onClick={reset}
              className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-blak-text-2 transition-colors hover:text-blak-text"
            >
              <span className="sr-only">{t('clear')}</span>
              <X className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>

        {/* ── Categories ── */}
        <div className="mt-6">
          <p id="faq-category-label" className="sr-only">
            {t('categoryLabel')}
          </p>
          <div role="group" aria-labelledby="faq-category-label" className="flex flex-wrap gap-2">
            <CategoryChip
              active={category === 'all'}
              onClick={() => setCategory('all')}
              label={t('allCategories')}
            />
            {availableCategories.map((entry) => (
              <CategoryChip
                key={entry.id}
                active={category === entry.id}
                onClick={() => setCategory(entry.id)}
                label={entry.label}
              />
            ))}
          </div>
        </div>

        {/* ── Result count, announced ── */}
        <p aria-live="polite" className="mt-6 text-sm text-blak-text-2">
          {countMessage}
        </p>
      </div>

      {/* ── Results ── */}
      <div className="min-w-0">
        {filtered.length > 0 ? (
          <PublicAccordion items={filtered} />
        ) : (
          <div className="rounded-2xl border border-blak-border/12 bg-blak-black/40 p-8 sm:p-10">
            <h3 className="text-lg font-semibold text-blak-text">{t('emptyTitle')}</h3>
            <p className="mt-3 max-w-[62ch] text-blak-body text-blak-text-2">{t('emptyBody')}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex min-h-11 items-center rounded-full border border-blak-border/25 px-5 text-sm font-semibold text-blak-text transition-colors hover:border-blak-border/50 hover:bg-blak-ivory/5"
            >
              {t('emptyReset')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors',
        active
          ? 'border-blak-green bg-blak-green/15 text-blak-text'
          : 'border-blak-border/15 text-blak-text-2 hover:border-blak-border/30 hover:text-blak-text',
      )}
    >
      {label}
    </button>
  );
}
