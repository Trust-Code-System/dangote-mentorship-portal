import { getTranslations } from 'next-intl/server';
import { PublicNav } from './public-nav';
import { PublicFooter } from './public-footer';
import { FilmGrain } from '@/app/(landing)/visuals/film-grain';

/**
 * The frame behind every Knowledge Library page — /about, /faq,
 * /confidentiality, /contact (PUBLIC_PAGES_MASTER_SPEC.md §3).
 *
 * It owns exactly what every public page shares and nothing that any single
 * page needs: the dark root, the skip link, landmark order (header → main →
 * footer), and the film grain that stops large black areas from banding.
 *
 * `landing-root` is the class that carries the dark scrollbar, the green focus
 * ring, the `scroll-margin-top` for anchored headings and the reduced-motion
 * rules. Reusing it — rather than cloning those rules under a new name — is
 * what guarantees a FAQ deep link and a landing anchor behave identically.
 *
 * Deliberately *not* included: `ScrollProgress` and anything WebGL. Those are
 * the landing page's, and the Library pages must stay lighter than it (§21 of
 * the brief).
 */
export async function PublicPageShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('landing.nav');

  return (
    <div className="landing-root relative min-h-screen overflow-x-hidden">
      <a
        href="#public-main"
        className="sr-only rounded-full bg-blak-green px-5 py-3 text-sm font-semibold text-blak-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]"
      >
        {t('skip')}
      </a>

      <PublicNav />

      <main id="public-main">{children}</main>

      <PublicFooter />
      <FilmGrain />
    </div>
  );
}
