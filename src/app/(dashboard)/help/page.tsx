import { getTranslations } from 'next-intl/server';
import { HELP_SLUGS } from '@/features/help/articles';
import { HelpSearch, type HelpArticleMeta } from './help-search';
import { ReplayTourButton } from '@/components/replay-tour-button';

// Help Center (experience-layer.md §1.11): short, searchable, bilingual articles
// per topic. Content is static i18n; the list is built server-side and filtered
// on the client. A control here re-arms the first-login tour.
export default async function HelpPage() {
  const t = await getTranslations('help');

  const articles: HelpArticleMeta[] = HELP_SLUGS.map((slug) => ({
    slug,
    title: t(`articles.${slug}.title`),
    summary: t(`articles.${slug}.summary`),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <ReplayTourButton />
      </div>

      <HelpSearch articles={articles} />
    </div>
  );
}
