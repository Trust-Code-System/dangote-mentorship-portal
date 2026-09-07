import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { CheckCircle2, ClipboardCheck, Lock } from 'lucide-react';
import { ReviewType } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
import { getDraft } from '@/features/drafts/data';
import { ReviewForm } from '@/features/reviews/review-form';
import { submitAssessmentForm } from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAssessmentAssignment, getWindowSubmission } from './data';
import { assessmentDraftKey } from './schema';

/**
 * Shared screen for both recurring mentee forms.
 *
 * QUARTERLY is the one screen a locked-out mentee can still reach, so it has to
 * explain the situation and let them fix it in one place. MONTHLY is the same
 * layout without the lock: what is due, the form, and the record so far. The
 * copy differs (separate i18n namespaces), the mechanics do not.
 */
export async function AssessmentScreen({
  formType = ReviewType.QUARTERLY,
}: {
  formType?: ReviewType;
} = {}) {
  const user = await requireUser();
  const isMonthly = formType === ReviewType.MONTHLY;
  const [t, format] = await Promise.all([
    getTranslations(isMonthly ? 'monthlyForm' : 'assessments'),
    getFormatter(),
  ]);
  // Render questions in the ACTIVE UI locale, not the saved account locale
  // (same rule as the review screen).
  const activeLocale = await getLocale();
  const lang = activeLocale.toLowerCase().startsWith('fr') ? 'FR' : 'EN';

  const assignment = await getAssessmentAssignment(user, formType);

  if (!assignment) {
    return (
      <Screen title={t('title')} subtitle={t('subtitle')}>
        <EmptyState
          icon={<ClipboardCheck className="size-6" aria-hidden />}
          title={t('notEligibleTitle')}
          description={t('notEligibleBody')}
        />
      </Screen>
    );
  }

  const { gate, current, form, history } = assignment;
  // The monthly form has no gate, so its outstanding window comes from the
  // assignment rather than from the gate.
  const target = current;
  const locked = !isMonthly && gate.state === 'LOCKED';

  return (
    <Screen title={t('title')} subtitle={t('subtitle')}>
      {locked ? (
        <div
          className="flex items-start gap-3 rounded-md border border-risk/40 bg-risk/10 px-4 py-3 text-small text-risk"
          role="alert"
        >
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{t('lockedExplainer')}</p>
        </div>
      ) : null}

      {!target ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6" aria-hidden />}
          title={t('noneDueTitle')}
          description={t('noneDueBody')}
        />
      ) : !form ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" aria-hidden />}
          title={t('notPublishedTitle')}
          description={t('notPublishedBody')}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-h2">{target.label}</CardTitle>
            <p className="text-small text-ink-2">
              {t('dueOn', { date: format.dateTime(target.dueAt, { dateStyle: 'long' }) })}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-small text-ink-2">{form.title}</p>
            <ReviewForm
              formId={form.id}
              type={formType}
              fields={form.schema.fields}
              lang={lang}
              cohortId={assignment.cohortId}
              submitAction={submitAssessmentForm}
              draftKey={assessmentDraftKey(target.id, form.id)}
              extraFields={{ windowId: target.id }}
              submitLabel={t('submit')}
              initial={await initialAnswersFor(user.id, target.id, form.id)}
            />
          </CardContent>
        </Card>
      )}

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('historyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colAssessment')}</TableHead>
                  <TableHead>{t('colDue')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.windowId}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell>{format.dateTime(entry.dueAt, { dateStyle: 'medium' })}</TableCell>
                    <TableCell>
                      {entry.submittedAt ? (
                        <span className="text-green-strong">
                          {t('completedOn', {
                            date: format.dateTime(entry.submittedAt, { dateStyle: 'medium' }),
                          })}
                        </span>
                      ) : (
                        <span className="text-ink-3">{t('outstanding')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </Screen>
  );
}

function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-display text-ink">{title}</h1>
        <p className="text-body text-ink-2">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Pre-fill order: a live autosaved draft first (mid-edit work is never lost),
 * then a previous submission for the same window if they are updating it.
 */
async function initialAnswersFor(
  userId: string,
  windowId: string,
  formId: string,
): Promise<Record<string, string> | undefined> {
  const draft = await getDraft<Record<string, string>>(
    userId,
    assessmentDraftKey(windowId, formId),
  );
  if (draft) return draft;

  const submitted = await getWindowSubmission(userId, windowId);
  if (!submitted) return undefined;

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(submitted.answers)) {
    out[key] = value == null ? '' : String(value);
  }
  return out;
}
