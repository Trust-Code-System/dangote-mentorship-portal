import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getUpcomingMeetings } from '@/features/admin/overview-data';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Programme-wide upcoming-meetings drill-down (reached from the admin dashboard
// "Upcoming meetings" tile). Read-only; admin-gated by the area layout (§4).
export default async function AdminMeetingsPage() {
  const t = await getTranslations('adminLists');
  const meetings = await getUpcomingMeetings();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('meetingsTitle')}</h1>
        <p className="text-body text-ink-2">{t('meetingsSubtitle')}</p>
      </div>

      {meetings.length === 0 ? (
        <p className="text-body text-ink-3">{t('noMeetings')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colWhen')}</TableHead>
              <TableHead>{t('colTitle')}</TableHead>
              <TableHead>{t('colType')}</TableHead>
              <TableHead>{t('colMentor')}</TableHead>
              <TableHead>{t('colMentee')}</TableHead>
              <TableHead>{t('colCohort')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium tabular-nums">
                  {m.startsAt ? m.startsAt.toISOString().slice(0, 16).replace('T', ' ') : t('notScheduled')}
                </TableCell>
                <TableCell>{m.title}</TableCell>
                <TableCell>
                  <StatusBadge status={m.type} tone="neutral" />
                </TableCell>
                <TableCell>
                  {m.mentorProfileId ? (
                    <Link href={`/admin/mentors/${m.mentorProfileId}`} className="text-green hover:text-green-strong hover:underline">
                      {m.mentorName ?? '—'}
                    </Link>
                  ) : (
                    (m.mentorName ?? '—')
                  )}
                </TableCell>
                <TableCell>
                  {m.menteeProfileId ? (
                    <Link href={`/admin/mentees/${m.menteeProfileId}`} className="text-green hover:text-green-strong hover:underline">
                      {m.menteeName ?? '—'}
                    </Link>
                  ) : (
                    (m.menteeName ?? '—')
                  )}
                </TableCell>
                <TableCell>{m.cohortName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
