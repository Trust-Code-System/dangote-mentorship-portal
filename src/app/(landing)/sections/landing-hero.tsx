'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowRight, ArrowUpRight, Check, MessageSquare, Target, Users } from 'lucide-react';

/** The public introduction uses the programme's actual stages, not mock analytics. */
export function LandingHero() {
  const t = useTranslations('landing.hero');
  const journey = useTranslations('journey');
  const steps = [
    { key: 'matched', Icon: Users },
    { key: 'goals', Icon: Target },
    { key: 'sessions', Icon: MessageSquare },
  ];
  return (
    <section className="border-blak-border/10 relative isolate overflow-hidden border-b px-5 pt-36 pb-16 sm:px-8 sm:pb-24 lg:pt-44">
      <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
        <div>
          <p className="text-blak-green-soft text-sm font-medium">{t('micro')}</p>
          <h1 className="text-blak-text mt-6 text-[clamp(2.75rem,5.5vw,5.5rem)] leading-[1.02] font-medium tracking-[-.055em]">
            <span className="block">{t('line1')}</span>
            <span className="text-blak-green block">{t('line2')}</span>
          </h1>
          <p className="text-blak-text-2 mt-7 max-w-xl text-base leading-relaxed sm:text-lg">
            {t('body')}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="bg-blak-green text-blak-black hover:bg-blak-green-soft inline-flex min-h-12 items-center justify-center gap-3 rounded-lg px-6 text-sm font-semibold transition-colors"
            >
              {t('ctaPrimary')}
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#journey"
              className="border-blak-border/20 text-blak-text inline-flex min-h-12 items-center justify-center gap-3 rounded-lg border px-6 text-sm font-medium transition-colors hover:bg-white/5"
            >
              {t('ctaSecondary')}
              <ArrowUpRight className="size-4" />
            </a>
          </div>
          <div className="border-blak-border/10 mt-10 flex max-w-full items-center gap-5 border-t pt-6">
            <Image
              src="/brand/dangote-logo.png"
              alt="Dangote"
              width={103}
              height={55}
              className="h-9 w-auto shrink-0"
            />
            <span aria-hidden className="bg-blak-border/15 h-8 w-px" />
            <div>
              <p className="text-blak-text-2 mb-2 text-[10px] font-medium">
                {t('partnershipLabel')}
              </p>
              <Image
                src="/brand/kennedia-consulting-logo.png"
                alt="Kennedia Consulting"
                width={320}
                height={91}
                className="h-7 w-auto max-w-44 object-contain object-left"
              />
            </div>
          </div>
        </div>
        <div className="border-blak-border/15 bg-blak-forest-2 rounded-2xl border p-6 shadow-[0_24px_60px_-24px_rgb(0_0_0/.4)] sm:p-8">
          <div className="border-blak-border/10 flex items-center justify-between border-b pb-6">
            <h2 className="text-blak-text text-base font-medium">{journey('title')}</h2>
            <span aria-hidden className="bg-blak-green size-2 rounded-full" />
          </div>
          <ol className="divide-blak-border/10 mt-2 divide-y">
            {steps.map(({ key, Icon }, i) => (
              <li key={key} className="flex items-center gap-5 py-7">
                <span className="border-blak-border/15 text-blak-green grid size-12 shrink-0 place-items-center rounded-xl border bg-white/5">
                  <Icon className="size-5" />
                </span>
                <span className="text-blak-text flex-1 text-lg font-medium">
                  {journey(`steps.${key}`)}
                </span>
                <span aria-hidden className="text-blak-text-2 text-xs tabular-nums">
                  0{i + 1}
                </span>
              </li>
            ))}
          </ol>
          <div className="border-blak-border/10 mt-2 flex items-center gap-3 rounded-lg border bg-white/[.03] p-4">
            <Check className="text-blak-green size-4" />
            <span className="text-blak-text-2 text-xs leading-relaxed">
              {journey('steps.completion')}
            </span>
            <ArrowUpRight className="text-blak-text-2 ml-auto size-4 shrink-0" />
          </div>
        </div>
      </div>
    </section>
  );
}
