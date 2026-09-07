import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CohortStatus, ReviewType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { listFormDefinitions } from '@/features/forms/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormRowActions } from './form-row-actions';

export default async function FormsPage() {
  await requireRole(ADMIN_ROLES);
  const t = await getTranslations('forms');

  // Forms are authored against the active cohort (mirrors the matching screen);
  // the cohort switcher arrives in a later milestone.
  const cohort = await prisma.cohort.findFirst({
    where: { deletedAt: null, status: CohortStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  });

  if (!cohort) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-display text-ink">{t('title')}</h1>
        <EmptyState title={t('noActiveCohort')} description={t('noActiveCohortHelp')} />
      </section>
    );
  }

  const definitions = await listFormDefinitions(cohort.id);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-display text-ink">{t('title')}</h1>
          <p className="text-small text-ink-2">{t('subtitle', { cohort: cohort.name })}</p>
        </div>
        <Button asChild>
          <Link href="/admin/forms/new">{t('newForm')}</Link>
        </Button>
      </div>

      {definitions.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyHelp')}
          action={
            <Button asChild>
              <Link href="/admin/forms/new">{t('newForm')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {definitions.map((d) => (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-h2">{d.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForType(d.type)}>{t(typeLabelKey(d.type))}</Badge>
                    <Badge variant="outline">{d.roleName ? t(`role${titleCase(d.roleName)}`) : t('allRoles')}</Badge>
                    <Badge variant={d.isActive ? 'ok' : 'neutral'}>
                      {d.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-small text-ink-2">
                  {t('questionCount', { count: d.fieldCount })} · {t('responseCount', { count: d.responseCount })}
                </p>
                <FormRowActions id={d.id} isActive={d.isActive} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/** i18n key for a form's review type. Exhaustive so a new type can't slip through. */
function typeLabelKey(type: ReviewType): 'midterm' | 'final' | 'quarterly' | 'monthly' {
  switch (type) {
    case ReviewType.MIDTERM:
      return 'midterm';
    case ReviewType.FINAL:
      return 'final';
    case ReviewType.QUARTERLY:
      return 'quarterly';
    case ReviewType.MONTHLY:
      return 'monthly';
  }
}

function badgeVariantForType(type: ReviewType): 'info' | 'default' | 'warn' | 'ok' {
  switch (type) {
    case ReviewType.MIDTERM:
      return 'info';
    case ReviewType.FINAL:
      return 'default';
    case ReviewType.QUARTERLY:
      return 'warn';
    case ReviewType.MONTHLY:
      return 'ok';
  }
}

function titleCase(role: string): string {
  // RoleName MENTOR → "Mentor" to compose the i18n key roleMentor.
  return role.charAt(0) + role.slice(1).toLowerCase();
}
