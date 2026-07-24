import { getLocale, getTranslations } from 'next-intl/server';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { ReviewType } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
import { getDraft } from '@/features/drafts/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { FormField } from '@/features/forms/schema';
import { getReviewAssignment, type SubmittedReview } from './data';
import { reviewDraftKey, type ReviewAnswers } from './schema';
import { ReviewForm } from './review-form';

// Shared fill/submit screen for both the mid-term and final reviews (CLAUDE.md
// §5, M3). The only difference between the two pages is the ReviewType and the
// title/subtitle copy, so the whole screen is parameterized here. Aggregation
// and the AI Review Assistant are separate, later M3 items.
export async function ReviewScreen({ type }: { type: ReviewType }) {
  const user = await requireUser();
  const t = await getTranslations('reviews');
  // QA-I18N-006: render review questions in the ACTIVE UI locale (header
  // switcher), not the saved account locale. The French question text already
  // exists on every form; it just wasn't being selected.
  const activeLocale = await getLocale();
  const lang = activeLocale.toLowerCase().startsWith('fr') ? 'FR' : 'EN';

  const isMidterm = type === ReviewType.MIDTERM;
  const title = isMidterm ? t('midtermTitle') : t('finalTitle');
  const subtitle = isMidterm ? t('midtermSubtitle') : t('finalSubtitle');

  const assignment = await getReviewAssignment(user, type);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-display text-ink">{title}</h1>
        <p className="text-body text-ink-2">{subtitle}</p>
      </div>

      {!assignment ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" aria-hidden />}
          title={t('notEligibleTitle')}
          description={t('notEligibleBody')}
        />
      ) : !assignment.form ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" aria-hidden />}
          title={t('notPublishedTitle')}
          description={t('notPublishedBody')}
        />
      ) : (
        <ReviewBody
          type={type}
          formId={assignment.form.id}
          formTitle={assignment.form.title}
          fields={assignment.form.schema.fields}
          lang={lang}
          cohortId={assignment.participant.cohortId}
          // A live draft (mid-edit) wins over a prior submission's answers.
          draft={await getDraft<Record<string, string>>(
            user.id,
            reviewDraftKey(type, assignment.form.id),
          )}
          submitted={assignment.submitted}
        />
      )}
    </div>
  );
}

function ReviewBody({
  type,
  formId,
  formTitle,
  fields,
  lang,
  cohortId,
  draft,
  submitted,
}: {
  type: ReviewType;
  formId: string;
  formTitle: string;
  fields: FormField[];
  lang: 'EN' | 'FR';
  cohortId: string;
  draft: Record<string, string> | null;
  submitted: SubmittedReview | null;
}) {
  // Prefer a live draft; else pre-fill from the last submission so an update
  // starts from what they sent (never lose work — experience-layer.md §1.11).
  const initial = draft ?? (submitted ? stringifyAnswers(submitted.answers) : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h2">{formTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {submitted ? <SubmittedBanner submittedAt={submitted.submittedAt} lang={lang} /> : null}
        <ReviewForm
          formId={formId}
          type={type}
          fields={fields}
          lang={lang}
          cohortId={cohortId}
          initial={initial}
        />
      </CardContent>
    </Card>
  );
}

async function SubmittedBanner({
  submittedAt,
  lang,
}: {
  submittedAt: Date | null;
  lang: 'EN' | 'FR';
}) {
  const t = await getTranslations('reviews');
  const when = submittedAt
    ? new Intl.DateTimeFormat(lang === 'FR' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium' }).format(
        submittedAt,
      )
    : '';
  return (
    <div className="flex items-start gap-2 rounded-md border border-ok/30 bg-green-soft px-3 py-2 text-small text-green-strong">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{t('submittedOn', { date: when })}</p>
    </div>
  );
}

/** Coerce stored answers (string | number | boolean | null) into the string map
 *  the form fields expect. */
function stringifyAnswers(answers: ReviewAnswers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}
