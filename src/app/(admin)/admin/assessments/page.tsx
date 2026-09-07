import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CohortStatus, ReviewType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { adminCohortFilter, requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getAssessmentOverview, listWindowCompletion } from '@/features/assessments/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile } from '@/components/ui/stat-tile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GenerateMonthlyForm } from './generate-monthly-form';
import { GenerateWindowsForm } from './generate-windows-form';
import { WindowEditor } from './window-editor';

// Admin view of the mandatory quarterly assessments: the cohort's schedule,
// completion per window, and who is in grace or already locked out. Answers are
// never shown here — completion is metadata (CLAUDE.md §4 / §14). To read the
// answers themselves, open the form's responses in the Forms area.
export default async function AdminAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; type?: string }>;
}) {
  const user = await requireRole(ADMIN_ROLES);
  const [t, format] = await Promise.all([getTranslations('assessments'), getFormatter()]);

  const { window: selectedWindowId, type } = await searchParams;
  // Two recurring mentee forms share this screen: the mandatory quarterly
  // assessment (gates the portal) and the monthly meeting form (reminders only).
  const formType = type === ReviewType.MONTHLY ? ReviewType.MONTHLY : ReviewType.QUARTERLY;
  const isMonthly = formType === ReviewType.MONTHLY;

  // Same convention as the other admin screens: act on the active cohort,
  // confined to the cohorts this admin may see.
  const cohort = await prisma.cohort.findFirst({
    where: { deletedAt: null, status: CohortStatus.ACTIVE, ...adminCohortFilter(user) },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (!cohort) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-display text-ink">{t('adminTitle')}</h1>
        <EmptyState title={t('noActiveCohort')} description={t('noActiveCohortHelp')} />
      </section>
    );
  }

  const overview = await getAssessmentOverview(cohort.id, formType);
  if (!overview) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-display text-ink">{t('adminTitle')}</h1>
        <EmptyState title={t('noActiveCohort')} description={t('noActiveCohortHelp')} />
      </section>
    );
  }

  const activeWindows = overview.windows.filter((w) => w.isActive);
  // Default the completion table to the window that matters right now: the
  // latest one already open, else the next one due. `hasOpened` is computed in
  // the data layer — reading the clock during render is not allowed here.
  const focus =
    activeWindows.find((w) => w.id === selectedWindowId) ??
    activeWindows.filter((w) => w.hasOpened).at(-1) ??
    activeWindows[0];

  const completion = focus ? await listWindowCompletion(overview.cohortId, focus.id) : [];
  const submitted = completion.filter((row) => row.submittedAt !== null).length;
  const locked = completion.filter((row) => row.state === 'LOCKED').length;
  const inGrace = completion.filter((row) => row.state === 'GRACE').length;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-display text-ink">
          {isMonthly ? t('adminMonthlyTitle') : t('adminTitle')}
        </h1>
        <p className="text-small text-ink-2">
          {isMonthly
            ? t('adminMonthlySubtitle', { cohort: overview.cohortName })
            : t('adminSubtitle', { cohort: overview.cohortName })}
        </p>
      </div>

      <nav aria-label={t('formTypeSwitcher')} className="flex flex-wrap gap-2">
        {[
          { type: ReviewType.QUARTERLY, label: t('tabQuarterly') },
          { type: ReviewType.MONTHLY, label: t('tabMonthly') },
        ].map((tab) => {
          const selected = tab.type === formType;
          return (
            <Link
              key={tab.type}
              href={`/admin/assessments?type=${tab.type}`}
              aria-current={selected ? 'page' : undefined}
              className={
                selected
                  ? 'rounded-md border border-green bg-green-soft px-3 py-1.5 text-small font-semibold text-green-strong'
                  : 'rounded-md border border-border px-3 py-1.5 text-small text-ink-2 hover:border-green'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {!overview.formPublished ? (
        <div className="rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-small" role="alert">
          <p className="font-semibold text-ink">{t('noFormTitle')}</p>
          <p className="text-ink-2">{isMonthly ? t('noFormBodyMonthly') : t('noFormBody')}</p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/admin/forms/new">{t('createForm')}</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('statMentees')} value={String(overview.menteeCount)} />
        <StatTile label={t('statSubmitted')} value={`${submitted}/${completion.length}`} />
        {isMonthly ? (
          <StatTile
            label={t('statOutstanding')}
            value={String(completion.length - submitted)}
          />
        ) : (
          <>
            <StatTile label={t('statGrace')} value={String(inGrace)} />
            <StatTile label={t('statLocked')} value={String(locked)} />
          </>
        )}
      </div>

      {isMonthly ? (
        <GenerateMonthlyForm
          cohortId={overview.cohortId}
          hasStartDate={overview.startDate !== null}
        />
      ) : (
        <GenerateWindowsForm
          cohortId={overview.cohortId}
          intervalMonths={overview.intervalMonths}
          graceDays={overview.graceDays}
          hasStartDate={overview.startDate !== null}
        />
      )}

      {overview.windows.length === 0 ? (
        <EmptyState title={t('noWindowsTitle')} description={t('noWindowsBody')} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('scheduleTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.windows.map((w) => (
              <WindowEditor
                key={w.id}
                window={{
                  id: w.id,
                  label: w.label,
                  opensAt: w.opensAt.toISOString(),
                  dueAt: w.dueAt.toISOString(),
                  graceDays: w.graceDays,
                  isActive: w.isActive,
                }}
                meta={t('windowMeta', {
                  lockDate: format.dateTime(w.lockAt, { dateStyle: 'medium' }),
                  submitted: w.submittedCount,
                  total: overview.menteeCount,
                })}
                isFocused={focus?.id === w.id}
                formType={formType}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {focus ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">
              {t('completionTitle', { label: focus.label })}
            </CardTitle>
            <p className="text-small text-ink-2">{t('completionSubtitle')}</p>
          </CardHeader>
          <CardContent>
            {completion.length === 0 ? (
              <EmptyState title={t('noMenteesTitle')} description={t('noMenteesBody')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colMentee')}</TableHead>
                    <TableHead>{t('colStatus')}</TableHead>
                    <TableHead>{t('colSubmitted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completion.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <span className="text-ink">{row.name ?? row.email}</span>
                        <span className="block text-small text-ink-3">{row.email}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stateVariant(row.state)}>{t(`state${row.state}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.submittedAt
                          ? format.dateTime(row.submittedAt, { dateStyle: 'medium' })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function stateVariant(state: string): 'ok' | 'warn' | 'risk' | 'neutral' {
  switch (state) {
    case 'CLEAR':
      return 'ok';
    case 'DUE':
      return 'neutral';
    case 'GRACE':
      return 'warn';
    case 'LOCKED':
      return 'risk';
    default:
      return 'neutral';
  }
}
