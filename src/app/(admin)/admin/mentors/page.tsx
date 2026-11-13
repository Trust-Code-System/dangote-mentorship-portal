import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function MentorsPage() {
  const t = await getTranslations('people');

  const mentors = await prisma.mentorProfile.findMany({
    where: { deletedAt: null },
    orderBy: { fullName: 'asc' },
    include: { cohort: { select: { name: true } } },
  });

  return (
    <section className="space-y-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('mentorsTitle')}</h1>
      {mentors.length === 0 ? (
        <p className="text-muted-foreground">{t('none')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('languageCol')}</TableHead>
              <TableHead>{t('department')}</TableHead>
              <TableHead>{t('experience')}</TableHead>
              <TableHead>{t('capacity')}</TableHead>
              <TableHead>{t('training')}</TableHead>
              <TableHead>{t('matchingCol')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mentors.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/mentors/${m.id}`} className="text-green hover:text-green-strong hover:underline">
                    {m.fullName}
                  </Link>
                </TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{m.preferredLanguage}</Badge>
                </TableCell>
                <TableCell>{m.department ?? '—'}</TableCell>
                <TableCell>{m.yearsExperience ?? '—'}</TableCell>
                <TableCell>{m.maxMentees}</TableCell>
                <TableCell>
                  <StatusBadge status={m.trainingStatus} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={m.matchingStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
