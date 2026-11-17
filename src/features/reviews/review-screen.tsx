import { getLocale, getTranslations } from 'next-intl/server';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { ReviewType } from '@prisma/client';
import Link from 'next/link';
import { getMentorPairings, getMenteePairing } from '@/lib/pairings';
import { prisma } from '@/lib/db/prisma';
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
export async function ReviewScreen({
  type,
  subjectMenteeId,
}: {
  type: ReviewType;
  subjectMenteeId?: string;
}) {
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

  const assignment = await getReviewAssignment(user, type, subjectMenteeId);
  const pairings = user.roles.includes('MENTOR') ? await getMentorPairings(user.id) : [];
  const subject =
    assignment?.form?.roleName === 'MENTOR' &&
    assignment.form.schema.fields.some((f) => f.sourceQuestion)
      ? assignment.participant.subjectMenteeId
      : undefined;
  const prefill: Record<string, string> = {};
  if (assignment?.form?.schema.fields.some((f) => f.sourceQuestion)) {
    const [cohort, profile, pairing] = await Promise.all([
      prisma.cohort.findUnique({
        where: { id: assignment.participant.cohortId },
        select: { startDate: true, endDate: true },
      }),
      assignment.participant.roleName === 'MENTOR'
        ? prisma.mentorProfile.findUnique({
            where: { userId: user.id },
            select: { department: true },
          })
        : prisma.menteeProfile.findUnique({
            where: { userId: user.id },
            select: { department: true },
          }),
      assignment.participant.roleName === 'MENTEE'
        ? getMenteePairing(user.id)
        : Promise.resolve(null),
    ]);
    Object.assign(prefill, {
      about_1: user.name ?? '',
      about_2: user.email,
      about_3: profile?.department ?? '',
      about_4: subject
        ? (pairings.find((p) => p.menteeId === subject)?.menteeName ?? '')
        : (pairing?.mentorName ?? ''),
      about_5: cohort?.startDate?.toISOString().slice(0, 10) ?? '',
      about_6:
        type === ReviewType.FINAL
          ? (cohort?.endDate?.toISOString().slice(0, 10) ?? '')
          : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Lagos' }).format(new Date()),
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-h1 text-ink font-semibold tracking-tight">{title}</h1>
        <p className="text-body text-ink-2">{subtitle}</p>
      </div>
      {subject && pairings.length > 0 ? (
        <nav aria-label="Review mentee" className="flex flex-wrap gap-2">
          {pairings.map((p) => (
            <Link
              key={p.menteeId}
              href={`?mentee=${p.menteeId}`}
              aria-current={subject === p.menteeId ? 'page' : undefined}
              className={`rounded-md border px-4 py-2 text-sm ${subject === p.menteeId ? 'bg-green text-white' : 'bg-surface'}`}
            >
              {p.menteeName ?? 'Mentee'}
            </Link>
          ))}
        </nav>
      ) : null}

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
          key={`${assignment.form.id}:${subject ?? 'self'}`}
          subjectMenteeId={subject}
          prefill={prefill}
          type={type}
          formId={assignment.form.id}
          formTitle={assignment.form.title}
          fields={assignment.form.schema.fields}
          lang={lang}
          cohortId={assignment.participant.cohortId}
          // A live draft (mid-edit) wins over a prior submission's answers.
          draft={await getDraft<Record<string, string | string[]>>(
            user.id,
            reviewDraftKey(type, assignment.form.id) + (subject ? `:${subject}` : ''),
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
  subjectMenteeId,
  prefill,
}: {
  type: ReviewType;
  formId: string;
  formTitle: string;
  fields: FormField[];
  lang: 'EN' | 'FR';
  cohortId: string;
  draft: Record<string, string | string[]> | null;
  submitted: SubmittedReview | null;
  subjectMenteeId?: string;
  prefill?: Record<string, string>;
}) {
  // Prefer a live draft; else pre-fill from the last submission so an update
  // starts from what they sent (never lose work — experience-layer.md §1.11).
  const initial = {
    ...prefill,
    ...(draft ?? (submitted ? stringifyAnswers(submitted.answers) : {})),
  };

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
          draftKey={reviewDraftKey(type, formId) + (subjectMenteeId ? `:${subjectMenteeId}` : '')}
          extraFields={subjectMenteeId ? { subjectMenteeId } : undefined}
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
    <div className="border-ok/30 bg-green-soft text-small text-green-strong flex items-start gap-2 rounded-md border px-3 py-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{t('submittedOn', { date: when })}</p>
    </div>
  );
}

/** Coerce stored answers into the shape the form fields expect. Multi-select
 *  answers stay as lists; everything else becomes a string. */
function stringifyAnswers(answers: ReviewAnswers): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (Array.isArray(v)) out[k] = v;
    else out[k] = v == null ? '' : String(v);
  }
  return out;
}
