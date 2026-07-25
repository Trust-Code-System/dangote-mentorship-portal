import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import { getAdminInsights } from '@/features/admin/insights-data';
import type { ChartLabels } from '@/features/admin/insights-charts';
import { Skeleton } from '@/components/ui/skeleton';

// Recharts is client-only and relatively heavy — keep it out of the initial
// admin shell graph so other admin navigations don't pay for the chart bundle.
const InsightsCharts = dynamic(
  () => import('@/features/admin/insights-charts').then((m) => m.InsightsCharts),
  {
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    ),
  },
);

// Admin Insights page (§12, §13) — programme analytics charts. Admin-gated by the
// (admin) area layout. Data is aggregated server-side; the charts render client-
// side (Recharts). Labels are translated here and passed down so the chart stays
// presentation-only.
export default async function AdminInsightsPage() {
  const t = await getTranslations('insights');
  const data = await getAdminInsights();

  const labels: ChartLabels = {
    languageTitle: t('languageTitle'),
    languageSubtitle: t('languageSubtitle'),
    matchingTitle: t('matchingTitle'),
    matchingSubtitle: t('matchingSubtitle'),
    trainingTitle: t('trainingTitle'),
    trainingSubtitle: t('trainingSubtitle'),
    goalsTitle: t('goalsTitle'),
    goalsSubtitle: t('goalsSubtitle'),
    mentors: t('mentors'),
    mentees: t('mentees'),
    matched: t('matched'),
    unmatched: t('unmatched'),
    completed: t('completed'),
    pending: t('pending'),
    submitted: t('submitted'),
    approved: t('approved'),
    goalCompleted: t('goalCompleted'),
    empty: t('empty'),
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-h1 text-ink">{t('title')}</h1>
        <p className="text-body text-ink-2">{t('subtitle')}</p>
      </header>

      <InsightsCharts data={data} labels={labels} />
    </div>
  );
}
