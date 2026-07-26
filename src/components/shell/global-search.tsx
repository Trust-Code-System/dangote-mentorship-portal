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

  const showDropdown = open && q.length >= 1;
  const hasResults = pageHits.length > 0 || visibleHits.length > 0;

  return (
    <div className="relative hidden max-w-md flex-1 sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        className="h-10 w-full rounded-full border border-border bg-surface-2 pl-9 pr-3 text-body text-ink placeholder:text-ink-3 focus-visible:outline-none focus-visible:border-green-light focus-visible:ring-2 focus-visible:ring-green-light/15"
      />

      {showDropdown && (
        <>
          <div aria-hidden className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute left-0 right-0 z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-surface py-2 shadow-elevation-lg">
            {visiblyPending && (
              <div className="flex items-center gap-2 px-4 py-2 text-small text-ink-3">
                <Loader2 className="size-4 animate-spin" />
                {t('searching')}
              </div>
            )}

            {pageHits.length > 0 && (
              <Group label={t('pages')}>
                {pageHits.map((p) => (
                  <ResultLink key={p.href} href={p.href} label={p.label} sublabel={null} tag={null} onNavigate={close} />
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
              <p className="px-4 py-3 text-small text-ink-3">{t('noResults')}</p>
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
      <p className="px-4 pb-1 text-micro uppercase tracking-wider text-ink-3">{label}</p>
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
        className="flex items-center justify-between gap-3 px-4 py-2 text-small hover:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block truncate text-ink">{label}</span>
          {sublabel && <span className="block truncate text-micro text-ink-3">{sublabel}</span>}
        </span>
        {tag && (
          <span className={cn('shrink-0 rounded-full bg-green-soft px-2 py-0.5 text-micro uppercase text-green-strong')}>
            {tag}
          </span>
        )}
      </Link>
    </li>
  );
}
