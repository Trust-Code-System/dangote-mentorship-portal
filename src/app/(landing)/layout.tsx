import { getTranslations } from 'next-intl/server';
import { ScrollProgress } from './components/scroll-progress';
import { FilmGrain } from './visuals/film-grain';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';

/**
 * Dark chrome for the public marketing home.
 *
 * `/` lives in its own route group so the cinematic landing page can own the
 * WebGL scene and the scroll-progress rail without loading either on the
 * Knowledge Library pages — and without touching the authenticated portal.
 *
 * The navigation and footer are **the same components** the Library pages use
 * (`src/components/public/`), not landing-specific copies. That is what stops
 * the two surfaces drifting apart, and it is why "About the programme" in the
 * footer now leads somewhere that looks like it belongs to the same site.
 *
 * Landmark order is header → main → footer, with the skip link as the first
 * focusable element on the page.
 */
export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('landing.nav');

  return (
    <div className="landing-root relative min-h-screen overflow-x-hidden">
      <a
        href="#landing-main"
        className="sr-only rounded-full bg-blak-green px-5 py-3 text-sm font-semibold text-blak-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]"
      >
        {t('skip')}
      </a>

      <ScrollProgress />
      <PublicNav />

      <main id="landing-main">{children}</main>

      <PublicFooter />
      <FilmGrain />
    </div>
  );
}
