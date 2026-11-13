'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SoftPanel } from '@/components/motion/soft-panel';

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
    <div
      ref={ref}
      className="fixed right-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2"
    >
      <SoftPanel
        open={open}
        role="menu"
        aria-label={t('title')}
        className="bg-popover absolute right-0 bottom-full mb-3 flex min-w-48 origin-bottom-right flex-col gap-1 rounded-lg border p-2 shadow-lg"
      >
        {items.map((item) => (
          <Link
            key={item.href + item.labelKey}
            href={item.href}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="hover:bg-accent rounded-md px-3 py-2 text-sm"
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </SoftPanel>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('title')}
        className={cn(
          'border-green-strong bg-green hover:bg-green-strong focus-visible:ring-green/30 flex h-14 w-14 items-center justify-center rounded-full border text-2xl text-white transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none',
          open && 'bg-green-strong',
        )}
      >
        <span
          aria-hidden
          className="transition-transform duration-500 ease-out"
          style={{ transform: open ? 'rotate(45deg)' : undefined }}
        >
          +
        </span>
      </button>
    </div>
  );
}
