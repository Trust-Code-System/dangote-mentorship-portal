import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CohortStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { EmptyState } from '@/components/ui/empty-state';
import { FormDefinitionEditor } from '../form-definition-editor';

export default async function NewFormPage() {
  await requireRole(ADMIN_ROLES);
  const t = await getTranslations('forms');

  const cohorts = await prisma.cohort.findMany({
    where: { deletedAt: null, status: { in: [CohortStatus.ACTIVE, CohortStatus.DRAFT] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, languages: true },
  });

  if (cohorts.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-display text-ink">{t('newForm')}</h1>
        <EmptyState title={t('noActiveCohort')} description={t('noActiveCohortHelp')} />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin/forms" className="text-small text-ink-2 hover:text-ink">
          ← {t('title')}
        </Link>
        <h1 className="font-display text-display text-ink">{t('newForm')}</h1>
        <p className="text-small text-ink-2">{t('builderHelp')}</p>
      </div>
      <FormDefinitionEditor cohorts={cohorts} />
    </section>
  );
}
