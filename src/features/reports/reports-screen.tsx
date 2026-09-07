import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { FileText } from 'lucide-react';
import { ReportKind } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
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
import { creatableKinds, listReports, reportableMentees } from './data';
import { CreateReportForm } from './create-report-form';

// Shared reports index, rendered inside both the participant shell (/reports)
// and the admin shell (/admin/reports) — the only difference is where detail
// links point, so the screen takes the base path rather than being duplicated.
export async function ReportsScreen({ basePath }: { basePath: string }) {
  const user = await requireUser();
  const [t, format] = await Promise.all([getTranslations('reports'), getFormatter()]);

  const [reports, mentees] = await Promise.all([listReports(user), reportableMentees(user)]);
  const kinds = creatableKinds(user);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-display text-ink">{t('title')}</h1>
        <p className="text-body text-ink-2">{t('subtitle')}</p>
      </div>

      {kinds.length > 0 ? <CreateReportForm kinds={kinds} mentees={mentees} /> : null}

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" aria-hidden />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('savedTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colReport')}</TableHead>
                    <TableHead>{t('colKind')}</TableHead>
                    <TableHead>{t('colPeriod')}</TableHead>
                    <TableHead>{t('colCreated')}</TableHead>
                    <TableHead className="text-right">{t('colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Link
                          href={`${basePath}/${report.id}`}
                          className="text-ink underline-offset-2 hover:underline"
                        >
                          {report.title}
                        </Link>
                        {report.aiPolished ? (
                          <Badge variant="info" className="ml-2">
                            {t('aiFormatted')}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">{t(kindKey(report.kind))}</Badge>
                      </TableCell>
                      <TableCell className="text-small text-ink-2">
                        {report.periodStart
                          ? `${format.dateTime(report.periodStart, { dateStyle: 'medium' })} – ${format.dateTime(
                              report.periodEnd ?? report.createdAt,
                              { dateStyle: 'medium' },
                            )}`
                          : t('periodToDate')}
                      </TableCell>
                      <TableCell className="text-small text-ink-2">
                        {format.dateTime(report.createdAt, { dateStyle: 'medium' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <a
                            className="rounded-md border border-border px-2.5 py-1 text-small text-ink hover:border-green"
                            href={`/api/reports/${report.id}/export?format=docx`}
                          >
                            {t('word')}
                          </a>
                          <a
                            className="rounded-md border border-border px-2.5 py-1 text-small text-ink hover:border-green"
                            href={`/api/reports/${report.id}/export?format=xlsx`}
                          >
                            {t('excel')}
                          </a>
                        </div>
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

/** i18n key for a report kind. Exhaustive: a new kind must be labelled. */
export function kindKey(kind: ReportKind): 'kindMentee' | 'kindMentor' | 'kindProgramme' {
  switch (kind) {
    case ReportKind.MENTEE_PROGRESS:
      return 'kindMentee';
    case ReportKind.MENTOR_PAIR:
      return 'kindMentor';
    case ReportKind.PROGRAMME:
      return 'kindProgramme';
  }
}
