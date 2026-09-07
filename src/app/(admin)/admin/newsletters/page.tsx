import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CohortStatus, NewsletterStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { adminCohortFilter, requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getScheduleSettings, listNewsletters } from '@/features/newsletters/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NewIssueForm } from './new-issue-form';
import { ScheduleForm } from './schedule-form';

// Admin newsletter queue: the recurring cadence, the drafts waiting for review,
// and what has already gone out.
export default async function AdminNewslettersPage() {
  const user = await requireRole(ADMIN_ROLES);
  const [t, format] = await Promise.all([getTranslations('newsletters'), getFormatter()]);

  const cohort = await prisma.cohort.findFirst({
    where: { deletedAt: null, status: CohortStatus.ACTIVE, ...adminCohortFilter(user) },
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

  const [newsletters, schedule] = await Promise.all([
    listNewsletters(user, cohort.id),
    getScheduleSettings(cohort.id),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-display text-ink">{t('title')}</h1>
        <p className="text-small text-ink-2">{t('subtitle', { cohort: cohort.name })}</p>
      </div>

      <ScheduleForm
        cohortId={cohort.id}
        enabled={schedule.enabled}
        sendDays={schedule.sendDays}
        sendHour={schedule.sendHour}
        timezone={schedule.timezone}
        autoDraft={schedule.autoDraft}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-h3">{t('newIssueTitle')}</CardTitle>
          <p className="text-small text-ink-2">{t('newIssueHelp')}</p>
        </CardHeader>
        <CardContent>
          <NewIssueForm cohortId={cohort.id} />
        </CardContent>
      </Card>

      {newsletters.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('issuesTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colIssue')}</TableHead>
                    <TableHead>{t('colStatus')}</TableHead>
                    <TableHead>{t('colRecipients')}</TableHead>
                    <TableHead>{t('colDate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newsletters.map((newsletter) => (
                    <TableRow key={newsletter.id}>
                      <TableCell>
                        <Link
                          href={`/admin/newsletters/${newsletter.id}`}
                          className="text-ink underline-offset-2 hover:underline"
                        >
                          {newsletter.title}
                        </Link>
                        <span className="block text-small text-ink-3">
                          {newsletter.subjectEn ?? t('noSubjectYet')}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {newsletter.aiDrafted ? (
                            <Badge variant="info">{t('aiDrafted')}</Badge>
                          ) : null}
                          {newsletter.fromSchedule ? (
                            <Badge variant="outline">{t('fromSchedule')}</Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(newsletter.status)}>
                          {t(`status${newsletter.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-small text-ink-2">
                        {newsletter.status === NewsletterStatus.SENT
                          ? `${newsletter.sentCount}/${newsletter.recipientCount}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-small text-ink-2">
                        {newsletter.sentAt
                          ? format.dateTime(newsletter.sentAt, { dateStyle: 'medium' })
                          : newsletter.scheduledAt
                            ? format.dateTime(newsletter.scheduledAt, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : format.dateTime(newsletter.createdAt, { dateStyle: 'medium' })}
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

function statusVariant(status: NewsletterStatus): 'neutral' | 'warn' | 'ok' {
  switch (status) {
    case NewsletterStatus.DRAFT:
      return 'neutral';
    case NewsletterStatus.SCHEDULED:
      return 'warn';
    case NewsletterStatus.SENT:
      return 'ok';
  }
}
