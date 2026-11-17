import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser, hasAnyRole } from '@/lib/auth/rbac';
import { RoleName } from '@/lib/auth/roles';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProgrammeCreateForm } from './programme-create-form';

export default async function ProgrammesPage() {
  const t = await getTranslations('admin');
  const tc = await getTranslations('common');
  const user = await requireUser();
  const canManage = hasAnyRole(user, RoleName.SUPER_ADMIN);

  const programmes = await prisma.programme.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { cohorts: { where: { deletedAt: null } } } } },
  });

  return (
    <section className="space-y-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('programmes')}</h1>

      {/* Creation is Super-Admin-only (CLAUDE.md §4). */}
      {canManage ? <ProgrammeCreateForm /> : null}

      {programmes.length === 0 ? (
        <p className="text-muted-foreground">{t('noProgrammes')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('programmeName')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('cohorts')}</TableHead>
              {canManage ? <TableHead>{tc('actions')}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {programmes.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell>{p._count.cohorts}</TableCell>
                {canManage ? (
                  <TableCell>
                    <Link href={`/admin/programmes/${p.id}/edit`} className="text-sm underline">
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
