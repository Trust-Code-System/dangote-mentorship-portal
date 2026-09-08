'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Floating Quick Actions menu (experience-layer.md §1.9). A single "+" — big touch
// target for mobile — opens the shortest path to the common flows. Items are
// role-filtered server-side and passed in; each is just a deep link. "Join clinic"
// joins the menu with the M4 community features.
export interface QuickActionItem {
  labelKey: string;
  href: string;
}

export function QuickActions({ items }: { items: QuickActionItem[] }) {
  const t = useTranslations('quickActions');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div
          role="menu"
          aria-label={t('title')}
          className="flex flex-col gap-1 rounded-lg border bg-popover p-2 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href + item.labelKey}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('title')}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full border border-green-strong bg-green text-2xl text-white transition-colors duration-150 hover:bg-green-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30 focus-visible:ring-offset-2 motion-reduce:transition-none',
          open && 'bg-green-strong',
        )}
      >
        <span aria-hidden>+</span>
      </button>
    </div>
  );
}
