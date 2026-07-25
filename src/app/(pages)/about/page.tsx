import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  Sparkles,
  Languages,
  Target,
  NotebookPen,
  Lock,
  ClipboardCheck,
  LifeBuoy,
} from 'lucide-react';
import { PublicPageHero } from '@/components/public/public-page-hero';
import { PublicBackgroundVisual } from '@/components/public/public-background';
import {
  PublicSection,
  PublicSectionHeading,
  EditorialBlock,
} from '@/components/public/public-section';
import { PublicFeatureGrid, type PublicFeature } from '@/components/public/public-feature-grid';
import { PublicCTA } from '@/components/public/public-cta';
import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';
import { JourneyRail, type JourneyStage } from './journey-rail';

/**
 * `/about` — the editorial explanation of the programme
 * (PUBLIC_PAGES_MASTER_SPEC.md §7.1).
 *
 * The page it replaces was a small hero and three gradient cards in the middle
 * of a white page. This one is a server component with eight sections that
 * alternate between black, forest and one warm ivory band, so the surface
 * itself gives the page a rhythm.
 *
 * Every capability named here is a shipped feature, and every figure in the
 * closing section describes how the programme is *built* (nine stages, six
 * criteria, six roles) rather than how many people are in it — participation
 * numbers are the programme office's to publish, and `tests/landing` has a
 * guard that fails the build if invented ones reappear.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.about.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/about' },
    openGraph: { title: t('title'), description: t('description'), type: 'article', url: '/about' },
  };
}

/** The nine stages, in the order the portal itself uses (`home.journey.nodes`). */
const STAGE_KEYS = [
  'profile',
  'training',
  'matched',
  'agreement',
  'goals',
  'sessions',
  'midterm',
  'final',
  'certificate',
] as const;

/** The six structural facts, from the landing page's verified `principles` set. */
const FACT_KEYS = ['months', 'stages', 'languages', 'criteria', 'roles', 'hardRule'] as const;

export default async function AboutPage() {
  const t = await getTranslations('publicPages.about');
  const ts = await getTranslations('publicPages.shared');
  // The journey stages and the structural facts are shared with the landing
  // page rather than restated, so the two public surfaces cannot drift apart.
  const tj = await getTranslations('landing.journey.stages');
  const tp = await getTranslations('landing.principles.facts');

  const stages: JourneyStage[] = STAGE_KEYS.map((key, index) => ({
    key,
    title: tj(`${key}.title`),
    body: tj(`${key}.body`),
    fragment: tj(`${key}.fragment`),
    // Formatted here rather than passing the translator down: a server
    // component cannot hand a function across the client boundary.
    label: t('journey.stageLabel', { number: index + 1 }),
  }));

  const featured: PublicFeature = {
    key: 'matching',
    title: t('different.matching.title'),
    body: t('different.matching.body'),
    detail: t('different.matching.detail'),
    icon: <Sparkles className="size-6" />,
  };

  const medium: PublicFeature[] = [
    {
      key: 'bilingual',
      title: t('different.bilingual.title'),
      body: t('different.bilingual.body'),
      detail: t('different.bilingual.detail'),
      icon: <Languages className="size-5" />,
    },
    {
      key: 'goals',
      title: t('different.goals.title'),
      body: t('different.goals.body'),
      detail: t('different.goals.detail'),
      icon: <Target className="size-5" />,
    },
  ];

  const compact: PublicFeature[] = [
    {
      key: 'sessions',
      title: t('different.sessions.title'),
      body: t('different.sessions.body'),
      icon: <NotebookPen className="size-4" />,
    },
    {
      key: 'private',
      title: t('different.private.title'),
      body: t('different.private.body'),
      icon: <Lock className="size-4" />,
    },
    {
      key: 'reviews',
      title: t('different.reviews.title'),
      body: t('different.reviews.body'),
      icon: <ClipboardCheck className="size-4" />,
    },
    {
      key: 'support',
      title: t('different.support.title'),
      body: t('different.support.body'),
      icon: <LifeBuoy className="size-4" />,
    },
  ];

  const humanPoints = ['suggest', 'editable', 'commit'] as const;

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

      {/* ── 1. Why BLAK MOH exists ─────────────────────────────────────── */}
      <PublicSection tone="forest" labelledBy="about-why">
        <PublicSectionHeading
          id="about-why"
          eyebrow={t('why.eyebrow')}
          title={t('why.title')}
          accent={t('why.titleAccent')}
        />
        <EditorialBlock className="mt-16" statement={t('why.statement')}>
          <p>{t('why.p1')}</p>
          <p>{t('why.p2')}</p>
        </EditorialBlock>
      </PublicSection>

      {/* ── 2. What makes it different ─────────────────────────────────── */}
      <PublicSection tone="black" labelledBy="about-different">
        <PublicSectionHeading
          id="about-different"
          eyebrow={t('different.eyebrow')}
          title={t('different.title')}
          accent={t('different.titleAccent')}
          lede={t('different.lede')}
        />
        <div className="mt-14">
          <PublicFeatureGrid featured={featured} medium={medium} compact={compact} />
        </div>
      </PublicSection>

      {/* ── 3. The nine-month journey ──────────────────────────────────── */}
      <PublicSection tone="forest-2" labelledBy="about-journey" id="journey">
        <PublicSectionHeading
          id="about-journey"
          eyebrow={t('journey.eyebrow')}
          title={t('journey.title')}
          accent={t('journey.titleAccent')}
          lede={t('journey.lede')}
        />
        <JourneyRail stages={stages} progressLabel={t('journey.progressLabel')} />
      </PublicSection>

      {/* ── 4. Human-led intelligence ──────────────────────────────────── */}
      <PublicSection tone="black" labelledBy="about-human">
        <PublicSectionHeading
          id="about-human"
          eyebrow={t('human.eyebrow')}
          title={t('human.title')}
          accent={t('human.titleAccent')}
        />
        <EditorialBlock className="mt-16" statement={t('human.statement')}>
          <p>{t('human.p1')}</p>
          <p>{t('human.p2')}</p>
        </EditorialBlock>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-blak-border/12 bg-blak-border/12 md:grid-cols-3">
          {humanPoints.map((point, index) => (
            <ScrollReveal key={point} delay={index * 0.08} className="bg-blak-black">
              <div className="h-full p-7">
                <p className="text-blak-label uppercase text-blak-green-soft">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-4 text-lg font-semibold text-blak-text">
                  {t(`human.points.${point}`)}
                </h3>
                <p className="mt-3 text-blak-body text-blak-text-2">
                  {t(`human.points.${point}Body`)}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </PublicSection>

      {/* ── 5. Bilingual participation — the one ivory band ────────────── */}
      <PublicSection tone="ivory" labelledBy="about-bilingual">
        <PublicSectionHeading
          id="about-bilingual"
          tone="light"
          eyebrow={t('bilingual.eyebrow')}
          title={t('bilingual.title')}
          accent={t('bilingual.titleAccent')}
          lede={t('bilingual.lede')}
        />

        {/* A true 50/50 split. Both panels are styled identically — same border,
            same weight, same type — because the moment one of them looks like
            the "other" option, French has been made secondary in the design
            even though it is equal in the product. */}
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {(
            [
              { code: 'en', label: t('bilingual.enLabel'), sample: t('bilingual.sampleEn') },
              { code: 'fr', label: t('bilingual.frLabel'), sample: t('bilingual.sampleFr') },
            ] as const
          ).map((panel, index) => (
            <ScrollReveal key={panel.code} delay={index * 0.08}>
              <div className="flex h-full flex-col rounded-2xl border border-blak-forest/15 bg-white/45 p-7 sm:p-8">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex size-9 items-center justify-center rounded-lg bg-blak-forest/10 text-xs font-bold uppercase tracking-wider text-blak-forest"
                  >
                    {panel.code}
                  </span>
                  <span className="text-base font-semibold text-blak-forest">{panel.label}</span>
                </div>
                <p className="mt-6 text-blak-label uppercase text-blak-green-deep">
                  {t('bilingual.sampleLabel')}
                </p>
                {/* `lang` on the sample so a screen reader switches voice for
                    it — the two panels are genuinely in different languages. */}
                <p
                  lang={panel.code}
                  className="mt-3 text-blak-body italic text-blak-forest-2/85"
                >
                  {panel.sample}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.1}>
          <div className="mt-10 flex flex-col gap-2 border-t border-blak-forest/12 pt-8 sm:flex-row sm:items-baseline sm:justify-between">
            <p className="font-serif text-xl italic text-blak-forest sm:text-2xl">
              {t('bilingual.sameDestination')}
            </p>
            <p className="text-sm text-blak-forest-2/75">{t('bilingual.switchHint')}</p>
          </div>
        </ScrollReveal>
      </PublicSection>

      {/* ── 6. Programme principles ────────────────────────────────────── */}
      <PublicSection tone="forest" labelledBy="about-principles">
        <PublicSectionHeading
          id="about-principles"
          eyebrow={t('principles.eyebrow')}
          title={t('principles.title')}
          lede={t('principles.lede')}
        />
        <dl className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FACT_KEYS.map((fact, index) => (
            <ScrollReveal key={fact} delay={index * 0.05}>
              {/* `flex-col-reverse` keeps the DOM in dt → dd order for
                  assistive technology while showing the figure above its
                  label, which is how a fact panel actually wants to read. */}
              <div className="flex flex-col-reverse border-t border-blak-border/12 pt-6">
                <dt className="mt-3 text-blak-body text-blak-text-2">{tp(fact)}</dt>
                <dd className="font-display text-5xl font-extrabold tracking-tight text-blak-text">
                  {tp(`${fact}Value`)}
                </dd>
              </div>
            </ScrollReveal>
          ))}
        </dl>
      </PublicSection>

      <PublicCTA
        title={t('cta.title')}
        accent={t('cta.titleAccent')}
        body={t('cta.body')}
        actions={[
          { href: '/login', label: ts('signIn'), variant: 'primary' },
          { href: '/signup', label: ts('requestAccess'), variant: 'secondary' },
          { href: '/faq', label: ts('readFaq'), variant: 'quiet' },
        ]}
      />
    </>
  );
}
