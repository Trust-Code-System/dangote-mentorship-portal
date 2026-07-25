import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';

/**
 * Home → current page. Two levels is the entire depth of the public site, so a
 * deeper trail would be theatre.
 *
 * A real `<nav aria-label>` containing an ordered list, with the current page
 * as plain text carrying `aria-current="page"` rather than a link to itself.
 */
export async function PublicBreadcrumb({ label }: { label: string }) {
  const t = await getTranslations('publicPages.shared');

  return (
    <nav aria-label={t('breadcrumbLabel')}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-blak-text-2">
        <li>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center transition-colors hover:text-blak-text"
          >
            {t('home')}
          </Link>
        </li>
        <li aria-hidden className="text-blak-text-2/50">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="inline-flex min-h-11 items-center text-blak-text">
          {label}
        </li>
      </ol>
    </nav>
  );
}
