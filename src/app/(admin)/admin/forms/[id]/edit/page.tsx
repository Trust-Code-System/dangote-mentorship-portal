import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CohortStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getFormDefinition } from '@/features/forms/data';
import { FormDefinitionEditor, type FormDefinitionInitial } from '../../form-definition-editor';

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(ADMIN_ROLES);
  const { id } = await params;
  const t = await getTranslations('forms');

  const definition = await getFormDefinition(id);
  if (!definition) notFound();

  // Offer the definition's own cohort plus other selectable cohorts so the type
  // / role / cohort can all be edited from one screen.
  const cohorts = await prisma.cohort.findMany({
    where: { deletedAt: null, status: { in: [CohortStatus.ACTIVE, CohortStatus.DRAFT] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, languages: true },
  });
  if (!cohorts.some((c) => c.id === definition.cohortId)) {
    const own = await prisma.cohort.findUnique({
      where: { id: definition.cohortId },
      select: { id: true, name: true, languages: true },
    });
    if (own) cohorts.unshift(own);
  }

  const initial: FormDefinitionInitial = {
    id: definition.id,
    cohortId: definition.cohortId,
    type: definition.type,
    roleName: definition.roleName,
    title: definition.title,
    isActive: definition.isActive,
    fields: definition.schema.fields,
  };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin/forms" className="text-small text-ink-2 hover:text-ink">
          ← {t('title')}
        </Link>
        <h1 className="font-display text-display text-ink">{t('editForm')}</h1>
        <p className="text-small text-ink-2">{t('builderHelp')}</p>
      </div>
      <FormDefinitionEditor cohorts={cohorts} initial={initial} />
    </section>
  );
}
