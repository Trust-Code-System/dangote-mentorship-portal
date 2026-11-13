import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProgrammeStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser, hasAnyRole } from '@/lib/auth/rbac';
import { RoleName } from '@/lib/auth/roles';
import { ProgrammeEditForm } from './programme-edit-form';

export default async function ProgrammeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('admin');
  const user = await requireUser();
  // Editing programmes is Super-Admin-only (CLAUDE.md §4), same as the actions.
  if (!hasAnyRole(user, RoleName.SUPER_ADMIN)) redirect('/admin/programmes');

  const programme = await prisma.programme.findFirst({ where: { id, deletedAt: null } });
  if (!programme) notFound();

  return (
    <section className="space-y-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('editProgramme')}</h1>
      <ProgrammeEditForm
        programme={{
          id: programme.id,
          name: programme.name,
          description: programme.description ?? '',
          status: programme.status,
        }}
        statuses={Object.values(ProgrammeStatus)}
      />
    </section>
  );
}
