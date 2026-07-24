import { getTranslations } from 'next-intl/server';
import { Download } from 'lucide-react';
import { getAdminDashboard } from '@/features/dashboard/data';
import { getCohortRisk, resolveActiveCohortId } from '@/features/risk/data';
import { getPairsTimeline } from '@/features/matching/timeline';
import { RiskPanel } from '@/features/risk/risk-panel';
import { AdminSummary } from '@/components/dashboard/admin-summary';
import { EngagementHeatmap } from '@/components/dashboard/engagement-heatmap';
import { NextActionButton } from '@/components/next-action-button';
import { Button } from '@/components/ui/button';

export default async function AdminHomePage() {
  const [dashboard, cohortId] = await Promise.all([
    getAdminDashboard(),
    resolveActiveCohortId(),
  ]);
  const [risk, timeline] = cohortId
    ? await Promise.all([getCohortRisk(cohortId), getPairsTimeline(cohortId)])
    : [null, null];
  const t = await getTranslations('admin');
  const programHealth = Math.round(
    (dashboard.activePairs / Math.max(1, dashboard.activePairs + dashboard.unmatchedMentees)) * 100,
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold text-ink">{t('dashboardTitle')}</h1>
          <p className="text-small text-ink-2">{t('dashboardSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">{t('last90')}</Button>
          <Button size="sm"><Download className="mr-2 size-4" /> {t('exportReport')}</Button>
        </div>
      </header>

      <AdminSummary data={dashboard} />

      <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_220px]">
        {timeline && timeline.pairs.length > 0 ? <EngagementHeatmap timeline={timeline} /> : <div />}
        <section className="grid place-items-center rounded-lg border border-border bg-surface p-5 shadow-elevation">
          <div className="text-center">
            <p className="text-small font-bold text-ink">{t('healthTitle')}</p>
            <div
              className="mx-auto mt-4 grid size-28 place-items-center rounded-full"
              style={{ background: `conic-gradient(rgb(var(--green)) ${programHealth}%, rgb(var(--surface-2)) 0)` }}
            >
              <div className="grid size-20 place-items-center rounded-full bg-surface text-h1 font-bold text-green-strong">{programHealth}</div>
            </div>
            <p className="mt-3 text-micro uppercase text-ink-3">
              {programHealth >= 60 ? t('healthOnTrack') : programHealth >= 30 ? t('healthRamping') : t('healthEarly')}
            </p>
          </div>
        </section>
      </div>

      <NextActionButton />
      {risk ? <RiskPanel risk={risk} /> : null}
    </div>
  );
}
