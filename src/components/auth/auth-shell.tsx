import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight, Check, LockKeyhole, Target, Users } from 'lucide-react';
import { BrandMark, BrandPlate } from '@/components/brand-logo';
import { AnimatedContent } from '@/components/motion/animated-content';
import { AuthBrandCopy } from './auth-brand-copy';
import { CollaborationCredit, PoweredByCredit } from './auth-attribution';

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const tc = await getTranslations('common');
  const t = await getTranslations('journey');
  const steps = ['matched', 'goals', 'sessions'];
  return (
    <div className="auth-workspace text-ink min-h-[100svh] bg-white lg:grid lg:grid-cols-[minmax(420px,1fr)_1fr] lg:p-3">
      <section className="auth-identity relative isolate hidden overflow-hidden rounded-2xl p-8 text-white lg:flex lg:flex-col xl:p-10">
        <div className="auth-contours" aria-hidden="true">
          <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
            {Array.from({ length: 16 }, (_, i) => (
              <path
                key={i}
                d={`M ${170 + i * 18} -80 C ${620 + i * 14} 180, ${-200 + i * 27} 460, ${480 + i * 17} 900`}
              />
            ))}
          </svg>
        </div>
        <Link
          href="/login"
          aria-label={tc('appName')}
          className="flex items-center gap-3 self-start"
        >
          <BrandMark className="h-10" />
          <span className="text-small max-w-36 leading-snug font-semibold">{tc('appName')}</span>
        </Link>
        <AnimatedContent className="relative mt-8 max-w-lg xl:mt-10">
          <AuthBrandCopy />
          <div className="auth-journey-art relative mt-6 h-[190px] xl:h-[210px]" aria-hidden="true">
            <div className="auth-arch auth-arch-back" />
            <div className="auth-arch auth-arch-front" />
            <div className="auth-connection absolute top-5 left-0 flex items-center gap-3 rounded-xl border border-white/20 bg-[#21483d]/90 px-4 py-3 shadow-lg">
              <span className="grid size-9 place-items-center rounded-full bg-white/10">
                <Users className="size-4" />
              </span>
              <span className="text-sm font-medium">{t('steps.matched')}</span>
              <Check className="ml-4 size-4 text-[#c4e6a6]" />
            </div>
            <div className="auth-goal absolute right-0 bottom-4 flex items-center gap-3 rounded-xl border border-white/30 bg-[#edf2e9] px-5 py-4 text-[#183e32] shadow-xl">
              <Target className="size-5" />
              <span className="text-sm font-medium">{t('steps.goals')}</span>
              <ArrowUpRight className="ml-5 size-4" />
            </div>
          </div>
          <div aria-hidden="true" className="mt-5 border-t border-white/20 pt-5">
            <div className="text-small mb-5 flex items-center justify-between font-medium">
              <span>{t('title')}</span>
              <ArrowUpRight className="size-4 text-white/60" />
            </div>
            <div className="flex items-center gap-2">
              {steps.map((step, i) => (
                <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white/30 text-[#d4edba]">
                    {i === 0 ? (
                      <Check className="size-3" />
                    ) : (
                      <span className="text-[10px]">{i + 1}</span>
                    )}
                  </span>
                  <span className="truncate text-[11px] text-white/75">{t(`steps.${step}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedContent>
        <div className="relative mt-auto flex flex-wrap items-end justify-between gap-5 pt-8">
          <CollaborationCredit />
          <PoweredByCredit />
        </div>
      </section>
      <div className="flex min-h-[100svh] flex-col bg-white lg:min-h-[calc(100svh-1.5rem)]">
        <header className="border-border flex items-center justify-between border-b px-5 py-4 lg:border-0 lg:px-8">
          <Link
            href="/login"
            aria-label={tc('appName')}
            className="flex items-center gap-2 lg:invisible"
          >
            <BrandPlate className="h-8" />
            <span className="text-small font-medium">{tc('appName')}</span>
          </Link>
          <LockKeyhole className="text-ink-3 size-4 shrink-0" aria-hidden />
        </header>
        <main className="flex flex-1 items-start justify-center px-5 pt-6 pb-8 sm:px-10 lg:pt-7 xl:pt-9">
          <AnimatedContent className="w-full max-w-[420px]">{children}</AnimatedContent>
        </main>
        <div className="border-border/60 flex flex-col items-center justify-center gap-3 border-t px-5 py-5 sm:flex-row lg:hidden">
          <CollaborationCredit onLight className="[&_*]:!text-ink-2" />
          <PoweredByCredit className="[&_*]:!text-ink-2" />
        </div>
      </div>
    </div>
  );
}
