import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CohortStatus, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { adminCohortFilter, requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getCohortEngagement } from '@/features/engagement/data';
import type { EngagementState } from '@/features/engagement/activity';
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

// Who has gone quiet (CLAUDE.md §9.8). Person-level, unlike the pair-level risk
// panel on the admin dashboard — a pair can look fine on session count while
// one side has done nothing for a month.
//
// Metadata only: the underlying reads select timestamps and counts, never
// message or journal content (§7, §10).
const STATES: EngagementState[] = ['never', 'inactive', 'quiet', 'active'];

export default async function AdminEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; role?: string }>;
}) {
  const user = await requireRole(ADMIN_ROLES);
  const [t, format] = await Promise.all([getTranslations('engagement'), getFormatter()]);
  const { state: stateFilter, role: roleFilter } = await searchParams;

  const cohort = await prisma.cohort.findFirst({
    where: { deletedAt: null, status: CohortStatus.ACTIVE, ...adminCohortFilter(user) },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (!cohort) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-display text-ink">{t('title')}</h1>
        <EmptyState title={t('noActiveCohort')} description={t('noActiveCohortHelp')} />
      </section>
    );
  }

  const engagement = await getCohortEngagement(cohort.id);
  if (!engagement) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-display text-ink">{t('title')}</h1>
        <EmptyState title={t('noActiveCohort')} description={t('noActiveCohortHelp')} />
      </section>
    );
  }

  const { summary, rows, thresholds } = engagement;
  const activeStateFilter = STATES.find((s) => s === stateFilter) ?? null;
  const activeRoleFilter =
    roleFilter === RoleName.MENTOR || roleFilter === RoleName.MENTEE ? roleFilter : null;

  const visible = rows.filter(
    (row) =>
      (activeStateFilter === null || row.state === activeStateFilter) &&
      (activeRoleFilter === null || row.role === activeRoleFilter),
  );

  /** Preserve the other filter when toggling one. */
  function href(next: { state?: string | null; role?: string | null }): string {
    const params = new URLSearchParams();
    const state = next.state === undefined ? activeStateFilter : next.state;
    const role = next.role === undefined ? activeRoleFilter : next.role;
    if (state) params.set('state', state);
    if (role) params.set('role', role);
    const query = params.toString();
    return query ? `/admin/engagement?${query}` : '/admin/engagement';
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-display text-ink">{t('title')}</h1>
          <p className="text-small text-ink-2">
            {t('subtitle', { cohort: engagement.cohortName })}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/reports">{t('seeReports')}</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('statNeedsAttention')} value={String(summary.needsAttention)} tone="risk" />
        <StatTile
          label={t('statInactive', { days: thresholds.inactiveAfterDays })}
          value={String(summary.inactive)}
          tone="risk"
        />
        <StatTile
          label={t('statQuiet', { days: thresholds.quietAfterDays })}
          value={String(summary.quiet)}
          tone="warn"
        />
        <StatTile label={t('statActive')} value={String(summary.active)} tone="ok" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-h3">{t('howTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-small text-ink-2">
            {t('howBody', {
              quiet: thresholds.quietAfterDays,
              inactive: thresholds.inactiveAfterDays,
              grace: thresholds.newJoinerGraceDays,
            })}
          </p>
          <p className="text-small text-ink-3">{t('privacyNote')}</p>
        </CardContent>
      </Card>

      <nav aria-label={t('filters')} className="flex flex-wrap items-center gap-2">
        <FilterLink href={href({ state: null })} selected={activeStateFilter === null}>
          {t('filterAll', { count: rows.length })}
        </FilterLink>
        {STATES.map((state) => (
          <FilterLink
            key={state}
            href={href({ state })}
            selected={activeStateFilter === state}
          >
            {t(`state${state}`)} ({summary[state]})
          </FilterLink>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <FilterLink href={href({ role: null })} selected={activeRoleFilter === null}>
          {t('roleAll')}
        </FilterLink>
        <FilterLink
          href={href({ role: RoleName.MENTOR })}
          selected={activeRoleFilter === RoleName.MENTOR}
        >
          {t('roleMentor')}
        </FilterLink>
        <FilterLink
          href={href({ role: RoleName.MENTEE })}
          selected={activeRoleFilter === RoleName.MENTEE}
        >
          {t('roleMentee')}
        </FilterLink>
      </nav>

      {visible.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('peopleTitle', { count: visible.length })}</CardTitle>
            <p className="text-small text-ink-2">{t('peopleSubtitle')}</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colPerson')}</TableHead>
                    <TableHead>{t('colRole')}</TableHead>
                    <TableHead>{t('colStatus')}</TableHead>
                    <TableHead>{t('colLastActive')}</TableHead>
                    <TableHead>{t('colDays')}</TableHead>
                    <TableHead>{t('colLastDid')}</TableHead>
                    <TableHead>{t('colFormsOwed')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <span className="text-ink">{row.name ?? row.email}</span>
                        <span className="block text-small text-ink-3">{row.email}</span>
                      </TableCell>
                      <TableCell className="text-small text-ink-2">
                        {row.role === RoleName.MENTOR ? t('roleMentor') : t('roleMentee')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stateVariant(row.state)}>{t(`state${row.state}`)}</Badge>
                      </TableCell>
                      <TableCell className="text-small text-ink-2">
                        {row.lastActiveAt
                          ? format.dateTime(row.lastActiveAt, { dateStyle: 'medium' })
                          : t('neverActive')}
                      </TableCell>
                      <TableCell className="text-small tabular-nums text-ink-2">
                        {row.daysSinceActive === null
                          ? t('sinceJoined', { days: row.daysSinceJoined })
                          : row.daysSinceActive}
                      </TableCell>
                      <TableCell className="text-small text-ink-2">
                        {row.lastSignal ? t(`signal${row.lastSignal}`) : '—'}
                      </TableCell>
                      <TableCell className="text-small tabular-nums text-ink-2">
                        {row.outstandingForms > 0 ? (
                          <span className="text-warn">{row.outstandingForms}</span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function FilterLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? 'page' : undefined}
      className={
        selected
          ? 'rounded-md border border-green bg-green-soft px-3 py-1.5 text-small font-semibold text-green-strong'
          : 'rounded-md border border-border px-3 py-1.5 text-small text-ink-2 hover:border-green'
      }
    >
      {children}
    </Link>
  );
}

function stateVariant(state: EngagementState): 'ok' | 'warn' | 'risk' | 'neutral' {
  switch (state) {
    case 'active':
      return 'ok';
    case 'quiet':
      return 'warn';
    case 'inactive':
      return 'risk';
    case 'never':
      return 'risk';
  }
}
