import Link from 'next/link';
import { RoleName } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import { getTrainingOverview } from '@/features/admin/overview-data';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatTile } from '@/components/ui/stat-tile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Programme-wide training-completion drill-down (reached from the admin dashboard
// "Training completed" tile). Read-only; admin-gated by the area layout (§4). The
// editable training-batch tooling (attendance/assessments) lands with M3.
export default async function AdminTrainingPage() {
  const [t, tPeople, tStatus] = await Promise.all([
    getTranslations('adminLists'),
    getTranslations('people'),
    getTranslations('statusLabel'),
  ]);
  const overview = await getTrainingOverview();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('trainingTitle')}</h1>
        <p className="text-body text-ink-2">{t('trainingSubtitle')}</p>
      </div>

      <div className="workspace-section stat-band overflow-hidden">
        <StatTile
          label={t('mentorsTrained')}
          value={`${overview.mentorsTrained} / ${overview.mentorsTotal}`}
          tone="ok"
        />
        <StatTile
          label={t('menteesTrained')}
          value={`${overview.menteesTrained} / ${overview.menteesTotal}`}
          tone="ok"
        />
      </div>

      {overview.rows.length === 0 ? (
        <p className="text-body text-ink-3">{t('noTraining')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colParticipant')}</TableHead>
              <TableHead>{t('colRole')}</TableHead>
              <TableHead>{tPeople('languageCol')}</TableHead>
              <TableHead>{tPeople('department')}</TableHead>
              <TableHead>{t('colStatus')}</TableHead>
              <TableHead>{t('colCohort')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.rows.map((r) => (
              <TableRow key={`${r.role}-${r.id}`}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/${r.role === RoleName.MENTOR ? 'mentors' : 'mentees'}/${r.id}`}
                    className="text-green hover:text-green-strong hover:underline"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell>{tStatus(r.role)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.language}</Badge>
                </TableCell>
                <TableCell>{r.department ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>{r.cohortName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
