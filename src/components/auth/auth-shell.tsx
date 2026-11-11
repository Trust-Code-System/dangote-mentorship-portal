import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight, Check, LockKeyhole } from 'lucide-react';
import { BrandPlate } from '@/components/brand-logo';
import { AuthBrandCopy } from './auth-brand-copy';
import { CollaborationCredit, PoweredByCredit } from './auth-attribution';

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const tc = await getTranslations('common');
  const t = await getTranslations('journey');
  const steps = ['matched', 'goals', 'sessions'];
  return (
    <div className="auth-workspace bg-bg text-ink min-h-[100svh] lg:grid lg:grid-cols-[minmax(420px,.95fr)_1.05fr]">
      <section className="border-border relative hidden flex-col border-r bg-[#eef1ee] p-10 lg:flex xl:p-12">
        <Link
          href="/welcome"
          aria-label={tc('appName')}
          className="flex items-center gap-3 self-start"
        >
          <BrandPlate className="h-10" />
          <span className="text-small max-w-36 leading-snug font-semibold">{tc('appName')}</span>
        </Link>
        <div className="my-auto max-w-lg py-8">
          <AuthBrandCopy />
          <div
            aria-hidden="true"
            className="shadow-elevation mt-10 rounded-xl border border-white bg-white/75 p-5"
          >
            <div className="text-small mb-5 flex items-center justify-between font-medium">
              <span>{t('title')}</span>
              <ArrowUpRight className="text-ink-3 size-4" />
            </div>
            <div className="flex items-center gap-2">
              {steps.map((step, i) => (
                <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="border-border text-green grid size-6 shrink-0 place-items-center rounded-full border bg-white">
                    {i === 0 ? (
                      <Check className="size-3" />
                    ) : (
                      <span className="text-[10px]">{i + 1}</span>
                    )}
                  </span>
                  <span className="text-ink-2 truncate text-[11px]">{t(`steps.${step}`)}</span>
                </div>
              ))}
            </div>
          </div>
          <CollaborationCredit onLight className="[&_*]:!text-ink-2 mt-8" />
        </div>
        <PoweredByCredit className="[&_*]:!text-ink-2" />
      </section>
      <div className="flex min-h-[100svh] flex-col bg-white">
        <header className="border-border flex items-center justify-between border-b p-5 lg:border-0 lg:p-6">
          <Link
            href="/welcome"
            aria-label={tc('appName')}
            className="flex items-center gap-2 lg:invisible"
          >
            <BrandPlate className="h-8" />
            <span className="text-small font-medium">{tc('appName')}</span>
          </Link>
          <LockKeyhole className="text-ink-3 size-4 shrink-0" aria-hidden />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
        <div className="border-border/60 flex flex-col items-center justify-center gap-3 border-t px-5 py-5 sm:flex-row lg:hidden">
          <CollaborationCredit onLight className="[&_*]:!text-ink-2" />
          <PoweredByCredit className="[&_*]:!text-ink-2" />
        </div>
      </div>
    </div>
  );
}
