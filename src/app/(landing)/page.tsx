import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/rbac';
import { defaultDashboardPath } from '@/lib/auth/roles';
import { LandingHero } from './sections/landing-hero';
import { SectionProblem } from './sections/section-problem';
import { SectionMatching } from './sections/section-matching';
import { SectionJourney } from './sections/section-journey';
import { SectionTools } from './sections/section-tools';
import { SectionBilingual } from './sections/section-bilingual';
import { SectionPrivacy } from './sections/section-privacy';
import { SectionPrinciples } from './sections/section-principles';
import { SectionTransformation } from './sections/section-transformation';

/**
 * Metadata for the landing page. Title/description follow the page locale.
 *
 * `robots` is intentionally left to the root layout's site-wide
 * `noindex, nofollow` (reinforced by src/app/robots.ts and the X-Robots-Tag
 * header): this is a confidential internal portal, so improving discoverability
 * would be a regression, not a win. The Open Graph tags are here for internal
 * link unfurls — Teams, Slack, email — which is where they actually matter.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing.meta');

  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/' },
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      url: '/',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  };
}

/**
 * The public landing page — "The Mentorship Continuum".
 *
 * A server component: it does the auth bounce, then composes the narrative.
 * Each section is a client component so it can own its own motion, but the copy
 * and structure are streamed from the server, which is what keeps the hero
 * headline and CTAs available on the very first paint.
 *
 * Section order is the story, not a feature list — see
 * LANDING_PAGE_MASTER_SPEC.md §2.
 */
export default async function LandingPage() {
  // Signed-in visitors never see the marketing page; they go to their dashboard.
  const currentUser = await getCurrentUser();
  if (currentUser) redirect(defaultDashboardPath(currentUser.roles));

  return (
    <>
      <LandingHero />
      <SectionProblem />
      <SectionMatching />
      <SectionJourney />
      <SectionTools />
      <SectionBilingual />
      <SectionPrivacy />
      <SectionPrinciples />
      <SectionTransformation />
    </>
  );
}
