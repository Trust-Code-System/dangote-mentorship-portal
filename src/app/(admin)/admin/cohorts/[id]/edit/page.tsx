import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CohortStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser, hasAnyRole } from '@/lib/auth/rbac';
import { RoleName } from '@/lib/auth/roles';
import { CohortEditForm } from './cohort-edit-form';

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

export default async function CohortEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('admin');
  const user = await requireUser();
  // Editing cohorts is Super-Admin-only (CLAUDE.md §4), same as the actions.
  if (!hasAnyRole(user, RoleName.SUPER_ADMIN)) redirect('/admin/cohorts');

  const [cohort, programmes] = await Promise.all([
    prisma.cohort.findFirst({ where: { id, deletedAt: null } }),
    prisma.programme.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  if (!cohort) notFound();

  return (
    <section className="space-y-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('editCohort')}</h1>
      <CohortEditForm
        cohort={{
          id: cohort.id,
          programmeId: cohort.programmeId,
          name: cohort.name,
          description: cohort.description ?? '',
          startDate: toDateInput(cohort.startDate),
          endDate: toDateInput(cohort.endDate),
          languages: cohort.languages,
          status: cohort.status,
        }}
        programmes={programmes}
        statuses={Object.values(CohortStatus)}
      />
    </section>
  );
}
