import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  KeyRound,
  Ticket,
  ShieldQuestion,
  BookOpen,
  UserCog,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { PublicPageHero } from '@/components/public/public-page-hero';
import { PublicBackgroundVisual } from '@/components/public/public-background';
import { PublicSection, PublicSectionHeading } from '@/components/public/public-section';
import { PublicCallout } from '@/components/public/public-callout';
import { PublicCTA } from '@/components/public/public-cta';
import { SpotlightCard } from '@/components/public/spotlight-card';
import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';

/**
 * `/contact` — the public support page (PUBLIC_PAGES_MASTER_SPEC.md §7.4).
 *
 * **Why `/contact` and not `/support`.** `/support` is the authenticated
 * participant support-request workflow (`src/app/(dashboard)/support`). A second
 * `/support` route would be a duplicate-route build error, and allow-listing
 * `/support` as public would have exposed the private request page. The footer
 * and navigation label this page "Support"; the URL is what differs.
 *
 * **Why there is no form.** No public intake endpoint exists in this
 * repository, and §22 of the brief forbids inventing a destination. A form
 * posting into a void is worse than no form, and a public inbox on a
 * confidential, invitation-only internal system would collect exactly the
 * information it should not. So the page routes by situation instead, and every
 * destination on it is a route that exists.
 *
 * No public programme inbox has been confirmed. Direct participants to the
 * existing private support workflow or their invitation contact instead.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.contact.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/contact' },
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'article',
      url: '/contact',
    },
  };
}

export default async function ContactPage() {
  const t = await getTranslations('publicPages.contact');
  const ts = await getTranslations('publicPages.shared');

  /** Four situations. Every href is a real, reachable route. */
  const routes = [
    {
      key: 'signin',
      Icon: KeyRound,
      primary: '/forgot-password',
      secondary: '/login',
    },
    {
      key: 'invite',
      Icon: Ticket,
      primary: '/signup',
      secondary: '/login',
    },
    {
      key: 'participant',
      Icon: UserCog,
      // Deep-links into the FAQ answer that explains what a support request is
      // and who can see it, rather than at `/support`, which would bounce a
      // signed-out visitor straight back to the sign-in page.
      primary: '/login',
      secondary: '/faq#q-support-anonymous',
    },
    {
      key: 'general',
      Icon: BookOpen,
      primary: '/faq',
      secondary: '/about',
    },
  ] as const;

  const topics = [
    { key: 'access', Icon: KeyRound, href: '/faq#q-forgot-password' },
    { key: 'programme', Icon: BookOpen, href: '/faq' },
    { key: 'matching', Icon: ShieldQuestion, href: '/faq#q-matching-how' },
    { key: 'confidentiality', Icon: ShieldQuestion, href: '/confidentiality' },
    { key: 'technical', Icon: Wrench, href: '/login' },
  ] as const;

  return (
    <>
      <PublicPageHero
        eyebrow={t('hero.eyebrow')}
        breadcrumbLabel={t('hero.breadcrumb')}
        title={t('hero.title')}
        titleAccent={t('hero.titleAccent')}
        lede={t('hero.lede')}
        motif={<PublicBackgroundVisual variant="signal" />}
      />

      {/* ── Route by situation ───────────────────────────────────────── */}
      <PublicSection tone="forest" labelledBy="contact-routes">
        <PublicSectionHeading
          id="contact-routes"
          eyebrow={t('routes.eyebrow')}
          title={t('routes.title')}
          lede={t('routes.lede')}
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {routes.map(({ key, Icon, primary, secondary }, index) => (
            <ScrollReveal key={key} delay={index * 0.07}>
              <SpotlightCard className="flex h-full flex-col p-8 sm:p-9">
                <span
                  aria-hidden
                  className="border-blak-green/25 bg-blak-green/10 text-blak-green-soft inline-flex size-11 items-center justify-center rounded-xl border"
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="text-blak-text mt-6 text-xl font-semibold">
                  {t(`routes.${key}.title`)}
                </h3>
                <p className="text-blak-body text-blak-text-2 mt-4 flex-1">
                  {t(`routes.${key}.body`)}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    href={primary}
                    className="bg-blak-green text-blak-black hover:bg-blak-green-soft inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors"
                  >
                    {t(`routes.${key}.primary`)}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link
                    href={secondary}
                    className="text-blak-text-2 hover:text-blak-text inline-flex min-h-12 items-center rounded-full px-4 text-sm font-semibold transition-colors"
                  >
                    {t(`routes.${key}.secondary`)}
                  </Link>
                </div>
              </SpotlightCard>
            </ScrollReveal>
          ))}
        </div>
      </PublicSection>

      {/* ── By topic ─────────────────────────────────────────────────── */}
      <PublicSection tone="black" labelledBy="contact-topics">
        <PublicSectionHeading
          id="contact-topics"
          eyebrow={t('topics.eyebrow')}
          title={t('topics.title')}
        />

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map(({ key, Icon, href }, index) => (
            <ScrollReveal key={key} delay={index * 0.05}>
              <li className="h-full">
                {/* The whole card is the link, so the target is 44px-plus in
                    every direction and the purpose is clear from the link text
                    alone — no "click here" and no hover-only affordance. */}
                <Link
                  href={href}
                  className="group border-blak-border/10 bg-blak-black/25 hover:border-blak-border/25 hover:bg-blak-black/50 flex h-full flex-col rounded-2xl border p-6 transition-colors"
                >
                  <span
                    aria-hidden
                    className="border-blak-border/15 text-blak-text-2 group-hover:text-blak-green-soft inline-flex size-9 items-center justify-center rounded-lg border transition-colors"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-blak-text mt-4 text-base font-semibold">
                    {t(`topics.${key}.title`)}
                  </span>
                  <span className="text-blak-text-2 mt-2 flex-1 text-sm leading-relaxed">
                    {t(`topics.${key}.body`)}
                  </span>
                  <span className="text-blak-green-soft mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
                    {t(`topics.${key}.cta`)}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            </ScrollReveal>
          ))}
        </ul>
      </PublicSection>

      {/* ── Reaching the programme office ────────────────────────────── */}
      <PublicSection tone="forest-2" labelledBy="contact-channel">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <PublicSectionHeading
              id="contact-channel"
              eyebrow={t('channel.eyebrow')}
              title={t('channel.title')}
            />
            <ScrollReveal delay={0.1}>
              <p className="text-blak-body text-blak-text-2 mt-8 max-w-[62ch]">
                {t('channel.body')}
              </p>
            </ScrollReveal>
          </div>

          <div className="space-y-8 lg:pt-4">
            <ScrollReveal delay={0.08}>
              <PublicCallout title={t('channel.supportTitle')}>
                {t('channel.supportBody')}
                <Link
                  href="/support"
                  className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4"
                >
                  {t('channel.supportTitle')} <ArrowRight aria-hidden className="size-4" />
                </Link>
              </PublicCallout>
            </ScrollReveal>

            <ScrollReveal delay={0.14}>
              <div className="border-blak-gold/20 bg-blak-gold/[0.04] rounded-2xl border p-6 sm:p-7">
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="border-blak-gold/25 text-blak-gold-soft mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border"
                  >
                    <AlertTriangle className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-blak-text text-base font-semibold">{t('urgent.title')}</h3>
                    <p className="text-blak-text-2 mt-2 text-sm leading-relaxed">
                      {t('urgent.body')}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </PublicSection>

      <PublicCTA
        title={t('cta.title')}
        accent={t('cta.titleAccent')}
        body={t('cta.body')}
        actions={[
          { href: '/faq', label: ts('readFaq'), variant: 'primary' },
          { href: '/login', label: ts('signIn'), variant: 'secondary' },
          { href: '/about', label: ts('aboutProgramme'), variant: 'quiet' },
        ]}
      />
    </>
  );
}
