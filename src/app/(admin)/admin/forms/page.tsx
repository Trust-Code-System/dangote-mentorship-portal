import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CohortStatus, ReviewType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole, adminCohortFilter } from '@/lib/auth/rbac';
import { notFound } from 'next/navigation';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { listFormDefinitions } from '@/features/forms/data';

import { STANDARD_FORMS } from '@/features/forms/catalogue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormRowActions } from './form-row-actions';

import { InstallStandardForms } from './install-standard-forms';

export default async function FormsPage({
  searchParams,
}: {
  searchParams?: Promise<{ cohort?: string }>;
}) {
  const user = await requireRole(ADMIN_ROLES);
  const t = await getTranslations('forms');

  // Forms are authored against the active cohort (mirrors the matching screen);
  // the cohort switcher arrives in a later milestone.
  const cohorts = await prisma.cohort.findMany({
    where: {
      id: adminCohortFilter(user).cohortId,
      deletedAt: null,
      status: { in: [CohortStatus.ACTIVE, CohortStatus.DRAFT] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, status: true },
  });
  const requested = (await searchParams)?.cohort;
  const cohort = requested
    ? cohorts.find((c) => c.id === requested)
    : (cohorts.find((c) => c.status === CohortStatus.ACTIVE) ?? cohorts[0]);
  if (requested && !cohort) notFound();

  if (!cohort) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-h1 text-ink font-semibold tracking-tight">{t('title')}</h1>
        <EmptyState title={t('noActiveCohort')} description={t('noActiveCohortHelp')} />
      </section>
    );
  }

  const definitions = await listFormDefinitions(cohort.id);
  const phase2 = Boolean(
    await prisma.featureFlag.findFirst({
      where: { cohortId: cohort.id, key: 'phase2_goal_setting', enabled: true, deletedAt: null },
      select: { id: true },
    }),
  );

  // Which standard sets this cohort is still missing, matched on type + role —
  // the same key the installer uses, so the count and the button agree.
  const present = new Set(definitions.map((d) => `${d.type}:${d.roleName ?? 'ANY'}`));
  const missingStandard = STANDARD_FORMS.filter(
    (form) => !present.has(`${form.type}:${form.roleName}`),
  ).length;

  return (
    <section className="space-y-6">
      <nav aria-label="Programme stream" className="flex flex-wrap gap-2">
        {cohorts.map((c) => (
          <Link
            key={c.id}
            href={`/admin/forms?cohort=${c.id}`}
            aria-current={c.id === cohort.id ? 'page' : undefined}
            className={`rounded-md border px-3 py-2 text-sm ${c.id === cohort.id ? 'bg-green text-white' : 'bg-surface'}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 text-ink font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-small text-ink-2">{t('subtitle', { cohort: cohort.name })}</p>
        </div>
        <Button asChild>
          <Link href="/admin/forms/new">{t('newForm')}</Link>
        </Button>
      </div>

      {phase2 ? (
        <div className="bg-muted space-y-2 rounded-md p-4 text-sm">
          <p>
            2026/2027 form pack: mentee goal setting, monthly review, and mentor/mentee mid-term and
            final reviews.
          </p>
          <Link href="/admin/forms/goal-setting" className="font-medium underline">
            Preview updated goal-setting form
          </Link>
        </div>
      ) : (
        <InstallStandardForms
          cohortId={cohort.id}
          missingCount={missingStandard}
          totalCount={STANDARD_FORMS.length}
        />
      )}

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
                  <h2 className="text-h2 text-foreground">{d.title}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForType(d.type)}>{t(typeLabelKey(d.type))}</Badge>
                    <Badge variant="outline">
                      {d.roleName ? t(`role${titleCase(d.roleName)}`) : t('allRoles')}
                    </Badge>
                    <Badge variant={d.isActive ? 'ok' : 'neutral'}>
                      {d.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-small text-ink-2">
                  {t('questionCount', { count: d.fieldCount })} ·{' '}
                  {t('responseCount', { count: d.responseCount })}
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
