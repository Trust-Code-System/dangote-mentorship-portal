import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Public marketing footer. Hosts the secondary nav (About / FAQ) that used to sit
// in the header, plus the programme tagline and confidentiality note. Shown on
// every public page via the (public) layout.
export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="border-t border-border bg-bg">
      <div className="container flex flex-col gap-4 py-8 text-small text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <p>{t('home.footer.tagline')}</p>

        <nav className="flex items-center gap-4">
          <Link href="/about" className="text-ink-2 hover:text-ink">
            {t('nav.about')}
          </Link>
          <Link href="/faq" className="text-ink-2 hover:text-ink">
            {t('nav.faq')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
