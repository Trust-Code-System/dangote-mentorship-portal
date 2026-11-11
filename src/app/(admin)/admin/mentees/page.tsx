import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function MenteesPage() {
  const t = await getTranslations('people');

  const mentees = await prisma.menteeProfile.findMany({
    where: { deletedAt: null },
    orderBy: { fullName: 'asc' },
    include: { cohort: { select: { name: true } } },
  });

  return (
    <section className="space-y-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('menteesTitle')}</h1>
      {mentees.length === 0 ? (
        <p className="text-muted-foreground">{t('none')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('languageCol')}</TableHead>
              <TableHead>{t('department')}</TableHead>
              <TableHead>{t('training')}</TableHead>
              <TableHead>{t('matchingCol')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mentees.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/mentees/${m.id}`} className="text-green hover:text-green-strong hover:underline">
                    {m.fullName}
                  </Link>
                </TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{m.preferredLanguage}</Badge>
                </TableCell>
                <TableCell>{m.department ?? '—'}</TableCell>
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
