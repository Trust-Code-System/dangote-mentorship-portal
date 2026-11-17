import { getTranslations } from 'next-intl/server';
import { Layers, Users, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import type { TrainerDashboard, BatchSummary } from './data';

// Trainer dashboard view (CLAUDE.md §12). Their cohort's training batches with
// attendance and assessment progress — cards over tables (design-system §3).
export async function TrainerDashboardView({ data, lang }: { data: TrainerDashboard; lang: 'EN' | 'FR' }) {
  const t = await getTranslations('trainer');

  if (data.batches.length === 0) {
    return <EmptyState title={t('noBatchesTitle')} description={t('noBatchesBody')} />;
  }

  return (
    <div className="space-y-6">
      <div className="workspace-section stat-band overflow-hidden">
        <StatTile label={t('batches')} value={data.totals.batches} icon={<Layers className="size-5" />} />
        <StatTile
          label={t('participants')}
          value={data.totals.participants}
          icon={<Users className="size-5" />}
        />
        <StatTile
          label={t('attendanceRate')}
          value={`${data.totals.attendanceRate}%`}
          tone={data.totals.attendanceRate >= 75 ? 'ok' : data.totals.attendanceRate >= 40 ? 'warn' : 'risk'}
          icon={<CheckCircle2 className="size-5" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.batches.map((b) => (
          <BatchCard key={b.id} batch={b} lang={lang} t={t} />
        ))}
      </div>
    </div>
  );
}

function BatchCard({
  batch,
  lang,
  t,
}: {
  batch: BatchSummary;
  lang: 'EN' | 'FR';
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const fmt = (d: Date | null) =>
    d ? new Intl.DateTimeFormat(lang === 'FR' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium' }).format(d) : null;
  const range = [fmt(batch.startDate), fmt(batch.endDate)].filter(Boolean).join(' – ');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">{batch.name}</CardTitle>
        {range ? <p className="text-small text-ink-3">{range}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3 text-small">
        <div className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-ink-2">{t('attendanceRate')}</span>
          <Progress
            value={batch.attendanceRate}
            tone={batch.attendanceRate >= 75 ? 'ok' : batch.attendanceRate >= 40 ? 'warn' : 'risk'}
            className="flex-1"
          />
          <span className="w-10 shrink-0 text-right tabular-nums text-ink-2">{batch.attendanceRate}%</span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t('participants')} value={batch.participants} />
          <Stat label={t('attended')} value={batch.attended} />
          <Stat label={t('passed')} value={batch.assessmentsPassed} />
        </dl>
        <p className="text-ink-3">{t('materialsCount', { count: batch.materials })}</p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface p-2">
      <dt className="text-micro uppercase text-ink-3">{label}</dt>
      <dd className="text-h3 tabular-nums text-ink">{value}</dd>
    </div>
  );
}
