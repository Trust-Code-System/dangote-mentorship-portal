import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser, hasAnyRole } from '@/lib/auth/rbac';
import { RoleName } from '@/lib/auth/roles';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CohortCreateForm } from './cohort-create-form';

export default async function CohortsPage() {
  const t = await getTranslations('admin');
  const tc = await getTranslations('common');
  const user = await requireUser();
  const canManage = hasAnyRole(user, RoleName.SUPER_ADMIN);

  const [cohorts, programmes] = await Promise.all([
    prisma.cohort.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { programme: { select: { name: true } } },
    }),
    prisma.programme.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <section className="space-y-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('cohorts')}</h1>

      {canManage ? <CohortCreateForm programmes={programmes} /> : null}

      {cohorts.length === 0 ? (
        <p className="text-muted-foreground">{t('noCohorts')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('cohortName')}</TableHead>
              <TableHead>{t('programmes')}</TableHead>
              <TableHead>{t('languages')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              {canManage ? <TableHead>{tc('actions')}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cohorts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.programme.name}</TableCell>
                <TableCell>{c.languages.join(', ')}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                {canManage ? (
                  <TableCell>
                    <Link href={`/admin/cohorts/${c.id}/edit`} className="text-sm underline">
                      {tc('edit')}
                    </Link>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
