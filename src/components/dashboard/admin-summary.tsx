import { getTranslations } from 'next-intl/server';
import type { AdminDashboard } from '@/features/dashboard/data';
import { MetricBand } from './metric-band';

export async function AdminSummary({ data }: { data: AdminDashboard }) {
  const t = await getTranslations('admin');
  const participants = data.activePairs * 2 + data.unmatchedMentees + data.unmatchedMentors;
  const matchRate = Math.round(
    (data.activePairs / Math.max(1, data.activePairs + data.unmatchedMentees)) * 100,
  );
  return (
    <MetricBand
      items={[
        { href: '/admin/matching', label: t('tileParticipants'), value: participants },
        {
          href: '/admin/mentees',
          label: t('tileUnmatched'),
          value: data.unmatchedMentees + data.unmatchedMentors,
        },
        { href: '/admin/support', label: t('tileOpenSupport'), value: data.openSupport },
        {
          href: '/admin/insights',
          label: t('tileMatchRate'),
          value: `${matchRate}%`,
          progress: matchRate,
        },
      ]}
    />
  );
}
