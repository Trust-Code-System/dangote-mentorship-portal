import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, ArrowUpRight, Download, Users } from 'lucide-react';
import { getAdminDashboard } from '@/features/dashboard/data';
import { getCohortRisk, resolveActiveCohortId } from '@/features/risk/data';
import { getPairsTimeline } from '@/features/matching/timeline';
import { RiskPanel } from '@/features/risk/risk-panel';
import { AdminSummary } from '@/components/dashboard/admin-summary';
import { EngagementHeatmap } from '@/components/dashboard/engagement-heatmap';
import { NextActionButton } from '@/components/next-action-button';
import { Button } from '@/components/ui/button';

export default async function AdminHomePage() {
  const [dashboard, cohortId] = await Promise.all([getAdminDashboard(), resolveActiveCohortId()]);
  const [risk, timeline] = cohortId
    ? await Promise.all([getCohortRisk(cohortId), getPairsTimeline(cohortId)])
    : [null, null];
  const t = await getTranslations('admin');
  const w = await getTranslations('workspace');
  const health = Math.round(
    (dashboard.activePairs / Math.max(1, dashboard.activePairs + dashboard.unmatchedMentees)) * 100,
  );
  const largest = Math.max(
    1,
    dashboard.activePairs,
    dashboard.unmatchedMentors,
    dashboard.unmatchedMentees,
  );
  const coverage = [
    { label: w('matchedPairs'), value: dashboard.activePairs, fill: 'bg-green/80' },
    { label: w('unmatchedMentors'), value: dashboard.unmatchedMentors, fill: 'bg-ink-3/50' },
    { label: w('unmatchedMentees'), value: dashboard.unmatchedMentees, fill: 'bg-ink-3/30' },
  ];
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl space-y-2">
          <p className="text-ink-3 text-xs font-medium">{w('overview')}</p>
          <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{w('adminTitle')}</h1>
          <p className="text-small text-ink-2 leading-relaxed">{w('adminSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/engagement">
              {t('viewEngagement')}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/reports">
              <Download className="size-4" />
              {t('exportReport')}
            </Link>
          </Button>
        </div>
      </header>
      <AdminSummary data={dashboard} />
      <div className="grid items-stretch gap-6 xl:grid-cols-[1.75fr_1fr]">
        {timeline && timeline.pairs.length ? (
          <EngagementHeatmap timeline={timeline} />
        ) : (
          <section className="workspace-section flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="border-border bg-surface-2 grid size-12 place-items-center rounded-xl border">
              <Users className="text-ink-3 size-6" />
            </span>
            <h2 className="text-h2 font-semibold">{w('matchedPairs')}</h2>
            <Link href="/admin/matching" className="workspace-link !text-green">
              {t('tileUnmatched')}
              <ArrowRight className="size-4" />
            </Link>
          </section>
        )}
        <section className="workspace-section overflow-hidden">
          <div className="workspace-section-heading">
            <h2>{w('coverage')}</h2>
            <Link href="/admin/insights" aria-label={t('tileMatchRate')} className="text-ink-3">
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="p-6">
            <div className="flex items-baseline gap-2">
              <p className="text-[40px] leading-none font-semibold tracking-[-.05em] tabular-nums">
                {health}
                <span className="text-ink-3 ml-1 text-2xl">%</span>
              </p>
              <span className="text-ink-3 text-xs">{t('tileMatchRate')}</span>
            </div>
            <div aria-hidden="true" className="workspace-progress-track mt-5">
              {Array.from({ length: 30 }, (_, i) => (
                <i key={i} data-filled={i < Math.round((health / 100) * 30)} />
              ))}
            </div>
            <div className="mt-7 space-y-5">
              {coverage.map((row) => (
                <div key={row.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-ink-2">{row.label}</span>
                    <span className="font-medium tabular-nums">{row.value}</span>
                  </div>
                  <div className="bg-surface-2 h-1 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${row.fill}`}
                      style={{ width: `${(row.value / largest) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      {risk ? <RiskPanel risk={risk} /> : null}
      <NextActionButton />
    </div>
  );
}
