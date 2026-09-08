import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MessageSquare, BookLock, PenLine } from 'lucide-react';
import { PublicPageHero } from '@/components/public/public-page-hero';
import { PublicBackgroundVisual } from '@/components/public/public-background';
import {
  PublicSection,
  PublicSectionHeading,
  EditorialBlock,
} from '@/components/public/public-section';
import { PublicCallout } from '@/components/public/public-callout';
import { PublicCTA } from '@/components/public/public-cta';
import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';

/**
 * `/confidentiality` — how the programme protects the mentorship relationship
 * (PUBLIC_PAGES_MASTER_SPEC.md §7.3).
 *
 * This route did not exist. The footer's "Confidentiality" link pointed at
 * `/faq` for want of a destination.
 *
 * The page is **informational and descriptive**. It is not a legal contract and
 * does not replace the mentoring and confidentiality agreements each pair signs
 * inside the portal — the copy says so explicitly.
 *
 * Every claim on this page was verified against the code before it was written,
 * and the source of each is recorded here so a future change to the model shows
 * up as a page that needs updating:
 *
 *  - DMs have exactly two participants; admins are never one
 *      → src/features/messages/data.ts
 *  - A reflection is private to its author; the mentor sees it only when it is
 *    explicitly shared AND the author is their mentee; admins are never a viewer
 *      → src/features/reflections/visibility.ts (pure, unit-tested)
 *  - Mentor private notes are visible only to their author
 *      → src/features/reflections/actions.ts, data.ts
 *  - Admins DO have a read-only view of mentor session logs, with mentor
 *    private notes excluded upstream
 *      → src/app/(admin)/admin/sessions/page.tsx
 *  - Support requests are anonymous to other participants only; the programme
 *    team always sees the requester
 *      → src/features/support/data.ts
 *  - The risk monitor consumes counts, dates and statuses only
 *      → src/features/risk/rules.ts
 *  - AI touches session notes, goals, reviews, meeting prep and explicit
 *    translation requests — not DMs or journal entries
 *      → src/features/sessions/summary.ts, goals/coach.ts, reviews/actions.ts,
 *        meetings/actions.ts, lib/translation/
 *
 * The "what administrators can see" section is deliberately as prominent as the
 * "what stays private" one. A confidentiality page that lists only the
 * reassuring half is the kind of half-promise that destroys trust the first
 * time someone discovers the other half themselves.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.confidentiality.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/confidentiality' },
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'article',
      url: '/confidentiality',
    },
  };
}

const VISIBLE_ITEMS = ['profiles', 'progress', 'sessions', 'activity'] as const;
const AI_ITEMS = ['processed', 'notProcessed', 'risk'] as const;
const RESPONSIBILITIES = ['respect', 'consent', 'escalate'] as const;

export default async function ConfidentialityPage() {
  const t = await getTranslations('publicPages.confidentiality');
  const ts = await getTranslations('publicPages.shared');

  const privateSpaces = [
    { key: 'messages', Icon: MessageSquare },
    { key: 'journal', Icon: BookLock },
    { key: 'notes', Icon: PenLine },
  ] as const;

  return (
    <>
      <PublicPageHero
        eyebrow={t('hero.eyebrow')}
        breadcrumbLabel={t('hero.breadcrumb')}
        title={t('hero.title')}
        titleAccent={t('hero.titleAccent')}
        lede={t('hero.lede')}
        motif={<PublicBackgroundVisual variant="veil" />}
      />

      {/* ── Opening statement ────────────────────────────────────────── */}
      <PublicSection tone="forest" labelledBy="conf-intro">
        <h2 id="conf-intro" className="sr-only">
          {t('intro.statement')}
        </h2>
        <EditorialBlock statement={t('intro.statement')}>
          <p>{t('intro.p1')}</p>
          <p>{t('intro.p2')}</p>
        </EditorialBlock>
      </PublicSection>

      {/* ── What stays private ───────────────────────────────────────── */}
      <PublicSection tone="black" labelledBy="conf-private">
        <PublicSectionHeading
          id="conf-private"
          eyebrow={t('private.eyebrow')}
          title={t('private.title')}
          accent={t('private.titleAccent')}
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {privateSpaces.map(({ key, Icon }, index) => (
            <ScrollReveal key={key} delay={index * 0.08}>
              <div className="flex h-full flex-col rounded-2xl border border-blak-green/15 bg-blak-green/[0.04] p-7 sm:p-8">
                <span
                  aria-hidden
                  className="inline-flex size-11 items-center justify-center rounded-xl border border-blak-green/25 bg-blak-green/10 text-blak-green-soft"
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold text-blak-text">
                  {t(`private.${key}.title`)}
                </h3>
                <p className="mt-3 text-blak-body text-blak-text-2">{t(`private.${key}.body`)}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </PublicSection>

      {/* ── What administrators can see ──────────────────────────────── */}
      <PublicSection tone="forest-2" labelledBy="conf-visible">
        <PublicSectionHeading
          id="conf-visible"
          eyebrow={t('visible.eyebrow')}
          title={t('visible.title')}
          accent={t('visible.titleAccent')}
          lede={t('visible.lede')}
        />

        {/* A definition list rather than cards: these are four plain statements
            of fact and dressing them as features would soften them. */}
        <dl className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {VISIBLE_ITEMS.map((item, index) => (
            <ScrollReveal key={item} delay={index * 0.06}>
              <div className="border-t border-blak-border/12 pt-6">
                <dt className="text-lg font-semibold text-blak-text">
                  {t(`visible.items.${item}.title`)}
                </dt>
                <dd className="mt-3 max-w-[62ch] text-blak-body text-blak-text-2">
                  {t(`visible.items.${item}.body`)}
                </dd>
              </div>
            </ScrollReveal>
          ))}
        </dl>

        <ScrollReveal delay={0.1}>
          <PublicCallout className="mt-14">{t('visible.note')}</PublicCallout>
        </ScrollReveal>
      </PublicSection>

      {/* ── Support requests ─────────────────────────────────────────────
          Two columns rather than a heading with a 68ch column under it and
          half the viewport left blank. */}
      <PublicSection tone="black" labelledBy="conf-support">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <PublicSectionHeading
            id="conf-support"
            eyebrow={t('support.eyebrow')}
            title={t('support.title')}
            accent={t('support.titleAccent')}
          />
          <ScrollReveal delay={0.1}>
            <div className="max-w-[62ch] space-y-5 text-blak-body text-blak-text-2 lg:pt-2">
              <p>{t('support.p1')}</p>
              <p>{t('support.p2')}</p>
            </div>
          </ScrollReveal>
        </div>
      </PublicSection>

      {/* ── The assistants ───────────────────────────────────────────── */}
      <PublicSection tone="forest" labelledBy="conf-ai">
        <PublicSectionHeading
          id="conf-ai"
          eyebrow={t('ai.eyebrow')}
          title={t('ai.title')}
          accent={t('ai.titleAccent')}
          lede={t('ai.lede')}
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-blak-border/12 bg-blak-border/12 lg:grid-cols-3">
          {AI_ITEMS.map((item, index) => (
            <ScrollReveal key={item} delay={index * 0.07} className="bg-blak-forest">
              <div className="h-full p-7 sm:p-8">
                <h3 className="text-lg font-semibold text-blak-text">
                  {t(`ai.items.${item}.title`)}
                </h3>
                <p className="mt-3 text-blak-body text-blak-text-2">{t(`ai.items.${item}.body`)}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </PublicSection>

      {/* ── Participant responsibilities — the ivory band ─────────────── */}
      <PublicSection tone="ivory" labelledBy="conf-responsibilities">
        <PublicSectionHeading
          id="conf-responsibilities"
          tone="light"
          eyebrow={t('responsibilities.eyebrow')}
          title={t('responsibilities.title')}
          accent={t('responsibilities.titleAccent')}
          lede={t('responsibilities.lede')}
        />

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {RESPONSIBILITIES.map((item, index) => (
            <ScrollReveal key={item} delay={index * 0.07}>
              <li className="border-t border-blak-forest/15 pt-6">
                <p className="text-blak-label uppercase text-blak-green-deep">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-4 text-lg font-semibold text-blak-forest">
                  {t(`responsibilities.items.${item}.title`)}
                </h3>
                <p className="mt-3 text-blak-body text-blak-forest-2/85">
                  {t(`responsibilities.items.${item}.body`)}
                </p>
              </li>
            </ScrollReveal>
          ))}
        </ol>

        <ScrollReveal delay={0.1}>
          {/* The signed agreements are deliberately described, not linked: the
              agreement records live behind authentication, and a public link
              into them would only ever produce a sign-in bounce. */}
          <PublicCallout
            tone="green"
            surface="light"
            className="mt-14"
            title={t('responsibilities.agreementsTitle')}
          >
            {t('responsibilities.agreementsBody')}
          </PublicCallout>
        </ScrollReveal>
      </PublicSection>

      <PublicCTA
        title={t('cta.title')}
        accent={t('cta.titleAccent')}
        body={t('cta.body')}
        actions={[
          { href: '/faq', label: ts('readFaq'), variant: 'primary' },
          { href: '/contact', label: ts('contactSupport'), variant: 'secondary' },
          { href: '/login', label: ts('signIn'), variant: 'quiet' },
        ]}
      />
    </>
  );
}
