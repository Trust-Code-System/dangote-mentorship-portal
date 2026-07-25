'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * A single footer destination, aware of whether it is the page you are on.
 *
 * The current page gets `aria-current="page"`, a brighter label **and** a small
 * green marker to its left — three signals, so the state is never carried by
 * colour alone (WCAG 2.2 §1.4.1). The marker keeps its box at every state and
 * animates `scale-x` only, so hovering the list never reflows it.
 *
 * A client component purely to read `usePathname()`; the footer around it stays
 * a server component.
 */
export function PublicFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href;

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'group flex min-h-11 items-center gap-2 text-sm transition-colors',
        current ? 'text-blak-text' : 'text-blak-text-2 hover:text-blak-text',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-px w-3 shrink-0 origin-left bg-blak-green transition-transform duration-300',
          current ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100',
        )}
      />
      {children}
    </Link>
  );
}
