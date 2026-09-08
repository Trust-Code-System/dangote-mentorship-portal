import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PublicPageHero } from '@/components/public/public-page-hero';
import { PublicBackgroundVisual } from '@/components/public/public-background';
import { PublicSection, PublicSectionHeading } from '@/components/public/public-section';
import { PublicCTA } from '@/components/public/public-cta';

export type PublicGuideKind = 'programme' | 'mentor' | 'mentee';

const STEP_KEYS = ['one', 'two', 'three', 'four'] as const;

export async function PublicGuidePage({ kind }: { kind: PublicGuideKind }) {
  const t = await getTranslations(`publicPages.guides.${kind}`);
  const shared = await getTranslations('publicPages.shared');

  return (
    <>
      <PublicPageHero
        eyebrow={t('hero.eyebrow')}
        breadcrumbLabel={t('hero.breadcrumb')}
        title={t('hero.title')}
        titleAccent={t('hero.titleAccent')}
        lede={t('hero.lede')}
        motif={<PublicBackgroundVisual variant="path" />}
      />

      <PublicSection tone="forest" labelledBy={`${kind}-guide-steps`}>
        <PublicSectionHeading
          id={`${kind}-guide-steps`}
          eyebrow={t('steps.eyebrow')}
          title={t('steps.title')}
          lede={t('steps.lede')}
        />
        <ol className="mt-12 grid gap-4 md:grid-cols-2">
          {STEP_KEYS.map((key, index) => (
            <li
              key={key}
              className="rounded-2xl border border-blak-border/12 bg-blak-black/25 p-6 sm:p-7"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blak-green text-sm font-bold text-blak-black">
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-blak-text">{t(`steps.${key}.title`)}</h2>
                  <p className="mt-2 text-blak-body text-blak-text-2">{t(`steps.${key}.body`)}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </PublicSection>

      <PublicSection tone="ivory" labelledBy={`${kind}-guide-privacy`}>
        <PublicSectionHeading
          id={`${kind}-guide-privacy`}
          tone="light"
          eyebrow={t('privacy.eyebrow')}
          title={t('privacy.title')}
          lede={t('privacy.body')}
        />
        <div className="mt-10 rounded-2xl border border-blak-forest/15 bg-white/45 p-6 sm:p-8">
          <p className="flex items-start gap-3 text-blak-body text-blak-forest-2">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-blak-green-deep" aria-hidden />
            {t('privacy.detail')}
          </p>
          <Link
            href="/confidentiality"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-blak-forest px-5 py-2.5 text-sm font-semibold text-white"
          >
            {shared('confidentiality')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </PublicSection>

      <PublicCTA
        title={t('cta.title')}
        accent={t('cta.titleAccent')}
        body={t('cta.body')}
        actions={[
          { href: '/login', label: shared('signIn'), variant: 'primary' },
          { href: '/faq', label: shared('readFaq'), variant: 'secondary' },
          { href: '/contact', label: shared('contactSupport'), variant: 'quiet' },
        ]}
      />
    </>
  );
}
