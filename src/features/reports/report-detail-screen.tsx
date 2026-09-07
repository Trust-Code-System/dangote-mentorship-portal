import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth/rbac';
import { getAiAdapter } from '@/lib/ai';
import { EmptyState } from '@/components/ui/empty-state';
import { getReadableReport } from './data';
import { ReportWorkspace } from './report-workspace';

// One saved report. Shared by the participant and admin routes; authorization
// lives in getReadableReport (author or in-scope admin), so an id belonging to
// someone else 404s here exactly as it does on the export route.
export async function ReportDetailScreen({
  reportId,
  basePath,
}: {
  reportId: string;
  basePath: string;
}) {
  const user = await requireUser();
  const t = await getTranslations('reports');

  const report = await getReadableReport(user, reportId);
  if (!report) notFound();

  return (
    <section className="space-y-6">
      <Link
        href={basePath}
        className="inline-flex items-center gap-1 text-small text-ink-2 underline-offset-2 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t('backToReports')}
      </Link>

      {!report.content ? (
        <EmptyState title={t('unreadableTitle')} description={t('unreadableBody')} />
      ) : (
        <ReportWorkspace
          reportId={report.id}
          title={report.title}
          saved={report.content}
          aiEnabled={getAiAdapter().enabled}
          canEdit={report.authorId === user.id}
        />
      )}
    </section>
  );
}
