import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Languages, Sparkles, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand-logo';
import { AuthVisual } from './auth-visual';
import { AuthBrandCopy } from './auth-brand-copy';

/**
 * The Threshold — the shared frame behind every authentication page
 * (AUTH_UI_SPEC.md §2).
 *
 * Desktop is a split screen: a dark cinematic brand panel on the left (~55%)
 * and the form on a warm ivory surface on the right (~45%). The ivory card
 * against the dark page is the point — it gives the form the strongest read on
 * the page, keeps input fields free of glass blur, and reads as paper rather
 * than as a floating dialog on white.
 *
 * Below `lg` the brand panel collapses to a compact header strip and the form
 * becomes the whole page: on a phone, a sign-in screen should be a sign-in
 * screen, not a scaled-down poster.
 */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');

  const principles = [
    { Icon: Languages, label: t('brandPointBilingual') },
    { Icon: Sparkles, label: t('brandPointMatching') },
    { Icon: ShieldCheck, label: t('brandPointPrivate') },
  ];

  return (
    <div className="landing-root relative min-h-[100svh] w-full overflow-x-hidden bg-blak-black lg:grid lg:grid-cols-[55fr_45fr]">
      {/* ── Left: brand panel (desktop) ── */}
      <section
        aria-label={t('brandEyebrow')}
        className="relative hidden overflow-hidden bg-blak-forest lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
      >
        <AuthVisual />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3 rounded-md">
            <BrandMark className="size-9" />
            <span className="font-display text-base font-extrabold tracking-tight text-blak-text">
              BLAK <span className="text-blak-green">MOH</span>
              <span className="text-blak-gold">.</span>
            </span>
          </Link>
        </div>

        {/* The message varies on /signup — a first-time visitor is beginning a
            journey, not continuing one (PUBLIC_PAGES_MASTER_SPEC.md §7.5). */}
        <div className="relative max-w-xl">
          <AuthBrandCopy />
        </div>

        <ul className="relative space-y-4">
          {principles.map(({ Icon, label }) => (
            <li key={label} className="flex items-center gap-3.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-blak-border/12 bg-blak-black/40 text-blak-green-soft">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-sm text-blak-text-2">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Right: form panel ── */}
      <div className="relative flex min-h-[100svh] flex-col lg:min-h-0">
        {/* Compact branded header — the brand panel's stand-in below `lg`. */}
        <header className="relative flex items-center justify-between overflow-hidden border-b border-blak-border/10 bg-blak-forest px-5 py-4 lg:hidden">
          <AuthVisual className="opacity-70" />
          <Link href="/" className="relative inline-flex items-center gap-2.5 rounded-md">
            <BrandMark className="size-8" />
            <span className="font-display text-sm font-extrabold tracking-tight text-blak-text">
              BLAK <span className="text-blak-green">MOH</span>
              <span className="text-blak-gold">.</span>
            </span>
          </Link>
          {/* No language switcher here: the form card carries one directly
              above the fields, and two controls for the same setting on one
              small screen is just confusing. */}
        </header>

        {/* A real `main` landmark. The auth pages previously had none, so the
            form — the entire point of the page — was not reachable by landmark
            navigation and the page's only h1 sat outside any landmark. */}
        <main className="flex flex-1 items-center justify-center px-5 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-10 lg:py-12">
          {/* 460px is the readable optimum for a single-column form; wider makes
              the label→field relationship harder to scan, not easier. */}
          <div className="w-full max-w-[460px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
