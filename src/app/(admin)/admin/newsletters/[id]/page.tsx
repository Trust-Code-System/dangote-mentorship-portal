import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getAiAdapter } from '@/lib/ai';
import { getNewsletter, listCohortRecipients } from '@/features/newsletters/data';
import { emptyNewsletterBody } from '@/features/newsletters/schema';
import { NewsletterComposer } from '@/features/newsletters/composer';
import { getCohortLanguages } from '@/features/cohorts/language-data';

export default async function AdminNewsletterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(ADMIN_ROLES);
  const t = await getTranslations('newsletters');

  const { id } = await params;
  // getNewsletter returns null for a cohort outside this admin's scope, so an
  // out-of-scope id 404s rather than leaking that the issue exists.
  const newsletter = await getNewsletter(user, id);
  if (!newsletter) notFound();

  const recipients = await listCohortRecipients(newsletter.cohortId);
  const cohortLanguages = await getCohortLanguages(newsletter.cohortId);

  return (
    <section className="space-y-6">
      <Link
        href="/admin/newsletters"
        className="inline-flex items-center gap-1 text-small text-ink-2 underline-offset-2 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t('backToList')}
      </Link>

      <div>
        <h1 className="font-display text-display text-ink">{newsletter.title}</h1>
        <p className="text-small text-ink-2">{t('composerSubtitle')}</p>
      </div>

      <NewsletterComposer
        newsletterId={newsletter.id}
        cohortName={newsletter.cohortName}
        status={newsletter.status}
        initialTitle={newsletter.title}
        initialSubjectEn={newsletter.subjectEn ?? ''}
        initialSubjectFr={newsletter.subjectFr ?? ''}
        // A newsletter created before the section model (or with unreadable
        // content) opens on a fresh, empty issue rather than a broken editor.
        initialBody={newsletter.body ?? emptyNewsletterBody()}
        recipientCount={recipients.length}
        approvedByName={newsletter.approvedByName}
        aiEnabled={getAiAdapter().enabled}
        sentCount={newsletter.sentCount}
        cohortLanguages={cohortLanguages}
      />
    </section>
  );
}
