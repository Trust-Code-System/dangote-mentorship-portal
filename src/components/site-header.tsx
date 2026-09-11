import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/rbac';
import { defaultDashboardPath } from '@/lib/auth/roles';
import { signOutAction } from '@/lib/auth/actions';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

// Public marketing header — wordmark + locale switcher + auth CTAs. Secondary nav
// (About / FAQ) lives in the SiteFooter. For signed-in visitors it stays a lean
// marketing bar — a single "Dashboard" CTA into the authenticated app shell (which
// owns the full nav) — rather than re-listing every app destination here.
export async function SiteHeader() {
  const t = await getTranslations();
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/welcome" className="text-ink" aria-label={t('common.appName')}>
          <BrandLogo
            name={t('common.appName')}
            markClassName="h-8 w-auto"
            wordmarkClassName="hidden sm:inline"
          />
        </Link>

        <nav className="flex items-center gap-2 text-small sm:gap-3">
          <LocaleSwitcher />

          {user ? (
            <>
              <Button asChild size="sm">
                <Link href={defaultDashboardPath(user.roles)}>{t('nav.dashboard')}</Link>
              </Button>
              <form action={signOutAction}>
                <Button type="submit" size="sm" variant="ghost">
                  {t('common.signOut')}
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">{t('nav.login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">{t('nav.signup')}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
