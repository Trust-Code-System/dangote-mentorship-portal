import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, LifeBuoy, LogIn } from 'lucide-react';
import { PublicPageHero } from '@/components/public/public-page-hero';
import { PublicBackgroundVisual } from '@/components/public/public-background';
import { PublicSection, PublicSectionHeading } from '@/components/public/public-section';
import { PublicAccordion } from '@/components/public/public-accordion';
import { PublicCTA } from '@/components/public/public-cta';
import { SpotlightCard } from '@/components/public/spotlight-card';
import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';
import { FAQ_CATEGORIES, FAQ_ENTRIES, type FaqCategory } from './faq-data';
import { FaqExplorer, type FaqExplorerItem } from './faq-explorer';

/**
 * `/faq` — the help centre (PUBLIC_PAGES_MASTER_SPEC.md §7.2).
 *
 * The previous page was two static cards in a narrow column. This one is a
 * searchable index of 25 questions across ten categories, with six featured
 * above it and a support band that separates the public route from the private
 * in-portal one.
 *
 * The page stays a server component: every question and answer is rendered into
 * the HTML, so the content is readable (and findable with the browser's own
 * find-in-page) before any JavaScript runs. `FaqExplorer` only filters what is
 * already there.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.faq.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/faq' },
    openGraph: { title: t('title'), description: t('description'), type: 'article', url: '/faq' },
  };
}

export default async function FaqPage() {
  const t = await getTranslations('publicPages.faq');
  const ts = await getTranslations('publicPages.shared');

  const categoryLabel = (id: FaqCategory) => t(`categories.${id}`);

  const items: FaqExplorerItem[] = FAQ_ENTRIES.map((entry) => ({
    id: entry.id,
    category: entry.category,
    categoryLabel: categoryLabel(entry.category),
    question: t(`items.${entry.id}.q`),
    answer: t(`items.${entry.id}.a`),
    meta: categoryLabel(entry.category),
  }));

  // Featured questions are the same records, so opening one from the short list
  // and finding it again in the full index behaves identically — including the
  // `/faq#q-<id>` deep link, which is why the featured copies carry a distinct
  // id prefix and the canonical ids stay with the full list below.
  const featured = FAQ_ENTRIES.filter((entry) => entry.featured).map((entry) => ({
    id: `featured-${entry.id}`,
    question: t(`items.${entry.id}.q`),
    answer: t(`items.${entry.id}.a`),
    meta: categoryLabel(entry.category),
  }));

  const categories = FAQ_CATEGORIES.map((id) => ({ id, label: categoryLabel(id) }));

  return (
    <>
      <PublicPageHero
        eyebrow={t('hero.eyebrow')}
        breadcrumbLabel={t('hero.breadcrumb')}
        title={t('hero.title')}
        titleAccent={t('hero.titleAccent')}
        lede={t('hero.lede')}
        motif={<PublicBackgroundVisual variant="library" />}
      />

      {/* ── Featured ─────────────────────────────────────────────────────
          An editorial split rather than a centred column: the heading holds
          the left third and the answers take the rest, so a 1440px viewport
          is used rather than padded with empty space on the right. */}
      <PublicSection tone="forest" labelledBy="faq-featured">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.6fr] lg:gap-16">
          <div>
            <PublicSectionHeading
              id="faq-featured"
              eyebrow={t('featured.eyebrow')}
              title={t('featured.title')}
            />
          </div>
          <PublicAccordion items={featured} />
        </div>
      </PublicSection>

      {/* ── Full searchable index ────────────────────────────────────── */}
      <PublicSection tone="black" labelledBy="faq-all" id="all-questions">
        <PublicSectionHeading
          id="faq-all"
          eyebrow={t('all.eyebrow')}
          title={t('all.title')}
          lede={t('all.lede')}
        />
        <div className="mt-12">
          <FaqExplorer items={items} categories={categories} />
        </div>
      </PublicSection>

      {/* ── Still need help ──────────────────────────────────────────── */}
      <PublicSection tone="forest-2" labelledBy="faq-help">
        <PublicSectionHeading
          id="faq-help"
          eyebrow={t('help.eyebrow')}
          title={t('help.title')}
          lede={t('help.lede')}
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <ScrollReveal>
            <SpotlightCard className="flex h-full flex-col p-8 sm:p-9">
              <span
                aria-hidden
                className="inline-flex size-11 items-center justify-center rounded-xl border border-blak-green/25 bg-blak-green/10 text-blak-green-soft"
              >
                <LogIn className="size-5" />
              </span>
              <h3 className="mt-6 text-xl font-semibold text-blak-text">
                {t('help.participantTitle')}
              </h3>
              <p className="mt-4 flex-1 text-blak-body text-blak-text-2">
                {t('help.participantBody')}
              </p>
              <Link
                href="/login"
                className="mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-blak-green px-6 text-sm font-semibold text-blak-black transition-colors hover:bg-blak-green-soft"
              >
                {t('help.participantCta')}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </SpotlightCard>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <SpotlightCard className="flex h-full flex-col p-8 sm:p-9">
              <span
                aria-hidden
                className="inline-flex size-11 items-center justify-center rounded-xl border border-blak-gold/25 bg-blak-gold/10 text-blak-gold-soft"
              >
                <LifeBuoy className="size-5" />
              </span>
              <h3 className="mt-6 text-xl font-semibold text-blak-text">{t('help.publicTitle')}</h3>
              <p className="mt-4 flex-1 text-blak-body text-blak-text-2">{t('help.publicBody')}</p>
              <Link
                href="/contact"
                className="mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-full border border-blak-border/25 px-6 text-sm font-semibold text-blak-text transition-colors hover:border-blak-border/50 hover:bg-blak-ivory/5"
              >
                {t('help.publicCta')}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </SpotlightCard>
          </ScrollReveal>
        </div>
      </PublicSection>

      <PublicCTA
        title={t('cta.title')}
        accent={t('cta.titleAccent')}
        body={t('cta.body')}
        actions={[
          { href: '/about', label: ts('aboutProgramme'), variant: 'primary' },
          { href: '/confidentiality', label: ts('confidentiality'), variant: 'secondary' },
          { href: '/login', label: ts('signIn'), variant: 'quiet' },
        ]}
      />
    </>
  );
}
