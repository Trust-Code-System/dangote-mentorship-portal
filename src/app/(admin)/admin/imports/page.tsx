import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CohortStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UploadForm } from './upload-form';

export default async function ImportsPage() {
  const t = await getTranslations('imports');

  const [cohorts, imports] = await Promise.all([
    prisma.cohort.findMany({
      where: { deletedAt: null, status: { in: [CohortStatus.DRAFT, CohortStatus.ACTIVE] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.import.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { cohort: { select: { name: true } } },
    }),
  ]);

  return (
    <section className="space-y-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>

      <UploadForm cohorts={cohorts} />

      {imports.length === 0 ? (
        <p className="text-muted-foreground">{t('noImports')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('file')}</TableHead>
              <TableHead>{t('cohort')}</TableHead>
              <TableHead>{t('targetRole')}</TableHead>
              <TableHead>{t('rows')}</TableHead>
              <TableHead>{t('statusLabel')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {imports.map((imp) => (
              <TableRow key={imp.id}>
                <TableCell className="font-medium">{imp.fileName}</TableCell>
                <TableCell>{imp.cohort.name}</TableCell>
                <TableCell>{imp.targetRole === 'MENTOR' ? t('mentors') : t('mentees')}</TableCell>
                <TableCell>
                  {imp.rowCount} · {imp.errorCount} {t('flagged')}
                </TableCell>
                <TableCell>
                  <StatusBadge status={imp.status} />
                </TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/imports/${imp.id}`}>{t('review')}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
