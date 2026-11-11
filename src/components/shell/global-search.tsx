'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search, Loader2 } from 'lucide-react';
import { searchPortal, type SearchHit } from '@/features/search/actions';
import { cn } from '@/lib/utils';

export interface SearchNavItem {
  label: string;
  href: string;
}

// Top-bar global search (CLAUDE.md §13). Always matches portal pages/nav
// client-side; for admins it also queries records (people/goals/meetings/
// cohorts) via the RBAC-scoped searchPortal action (debounced).
export function GlobalSearch({ navItems }: { navItems: SearchNavItem[] }) {
  const t = useTranslations('search');
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [pending, setPending] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const q = query.trim();

  const pageHits = React.useMemo(() => {
    if (q.length < 1) return [];
    const lower = q.toLowerCase();
    return navItems.filter((n) => n.label.toLowerCase().includes(lower)).slice(0, 6);
  }, [q, navItems]);

  React.useEffect(() => {
    if (q.length < 2) return;
    const id = setTimeout(async () => {
      setPending(true);
      try {
        const res = await searchPortal({ query: q });
        setHits(res.ok ? res.data.hits : []);
      } finally {
        setPending(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const visibleHits = q.length >= 2 ? hits : [];
  const visiblyPending = q.length >= 2 && pending;

  function close() {
    setOpen(false);
  }

  // The panel opens on focus, so WCAG 2.2 SC 1.4.13 requires a way to dismiss it
  // without moving focus. Escape alone isn't enough: returning focus to the input
  // re-fires onFocus and the panel springs straight back open, so the dismissal
  // is latched until the query changes.
  function dismiss() {
    setDismissed(true);
    setOpen(false);
    inputRef.current?.focus();
  }

  const showDropdown = open && !dismissed && q.length >= 1;
  const hasResults = pageHits.length > 0 || visibleHits.length > 0;

  return (
    <div
      className="relative hidden max-w-md flex-1 sm:block"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && showDropdown) {
          e.stopPropagation();
          dismiss();
        }
      }}
    >
      <Search className="text-ink-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          // Typing is an explicit request for results, so it both releases the
          // Escape latch and re-opens: after Escape the input still holds focus,
          // so onFocus will not fire again to do it.
          setDismissed(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        className="border-border bg-surface text-body text-ink placeholder:text-ink-3 focus-visible:border-green-light focus-visible:ring-green-light/15 h-10 w-full rounded-md border pr-3 pl-9 focus-visible:ring-2 focus-visible:outline-none"
      />

      {showDropdown && (
        <>
          <div aria-hidden className="fixed inset-0 z-40" onClick={close} />
          <div className="border-border bg-surface shadow-elevation-lg absolute right-0 left-0 z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border py-2">
            {visiblyPending && (
              <div className="text-small text-ink-3 flex items-center gap-2 px-4 py-2">
                <Loader2 className="size-4 animate-spin" />
                {t('searching')}
              </div>
            )}

            {pageHits.length > 0 && (
              <Group label={t('pages')}>
                {pageHits.map((p) => (
                  <ResultLink
                    key={p.href}
                    href={p.href}
                    label={p.label}
                    sublabel={null}
                    tag={null}
                    onNavigate={close}
                  />
                ))}
              </Group>
            )}

            {visibleHits.length > 0 && (
              <Group label={t('records')}>
                {visibleHits.map((h, i) => (
                  <ResultLink
                    key={`${h.kind}-${h.href}-${i}`}
                    href={h.href}
                    label={h.label}
                    sublabel={h.sublabel}
                    tag={t(`kind.${h.kind}`)}
                    onNavigate={close}
                  />
                ))}
              </Group>
            )}

            {!visiblyPending && !hasResults && q.length >= 2 && (
              <p className="text-small text-ink-3 px-4 py-3">{t('noResults')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-micro text-ink-3 px-4 pb-1 tracking-wider uppercase">{label}</p>
      <ul>{children}</ul>
    </div>
  );
}

function ResultLink({
  href,
  label,
  sublabel,
  tag,
  onNavigate,
}: {
  href: string;
  label: string;
  sublabel: string | null;
  tag: string | null;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="text-small hover:bg-surface flex items-center justify-between gap-3 px-4 py-2"
      >
        <span className="min-w-0">
          <span className="text-ink block truncate">{label}</span>
          {sublabel && <span className="text-micro text-ink-3 block truncate">{sublabel}</span>}
        </span>
        {tag && (
          <span
            className={cn(
              'bg-green-soft text-micro text-green-strong shrink-0 rounded-md px-2 py-0.5 uppercase',
            )}
          >
            {tag}
          </span>
        )}
      </Link>
    </li>
  );
}
