import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import type { AdminDashboard } from '@/features/dashboard/data';
import { StatTile, type StatTileProps } from '@/components/ui/stat-tile';

// Admin "programme at a glance" tiles (experience-layer.md §1.1 / §19 §8), from
// records available today. Now icon-led, status-toned, and deep-linked. Review
// completion (M3), clinic attendance (M4) and the programme health score (Tier 2)
// join as they land.
function Tile({ href, ...props }: StatTileProps & { href?: string }) {
  if (!href) return <StatTile {...props} />;
  return (
    <Link href={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30">
      <StatTile {...props} className="h-full transition-shadow hover:shadow-elevation" />
    </Link>
  );
}

export async function AdminSummary({ data }: { data: AdminDashboard }) {
  const t = await getTranslations('admin');
  const participants = data.activePairs * 2 + data.unmatchedMentees + data.unmatchedMentors;
  const matchRate = Math.round((data.activePairs / Math.max(1, data.activePairs + data.unmatchedMentees)) * 100);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        href="/admin/matching"
        label={t('tileParticipants')}
        value={participants}
        tone="ok"
        icon={<Users className="size-5" />}
      />
      <Tile
        href="/admin/mentees"
        label={t('tileUnmatched')}
        value={data.unmatchedMentees + data.unmatchedMentors}
        tone={data.unmatchedMentees > 0 ? 'warn' : 'default'}
        icon={<GraduationCap className="size-5" />}
      />
      <Tile
        href="/admin/support"
        label={t('tileOpenSupport')}
        value={data.openSupport}
        tone={data.openSupport > 0 ? 'risk' : 'default'}
        icon={<AlertTriangle className="size-5" />}
      />
      <Tile
        href="/admin/insights"
        label={t('tileMatchRate')}
        value={`${matchRate}%`}
        tone={matchRate >= 60 ? 'ok' : matchRate >= 30 ? 'warn' : 'risk'}
        icon={<ShieldCheck className="size-5" />}
      />
    </div>
  );
}
