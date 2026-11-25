import { getTranslations } from 'next-intl/server';
import { GoalStage, GoalStatus } from '@prisma/client';
import type { GoalWithDetail } from '@/features/goals/data';
import { MENTEE_WORKING_STAGES, menteeAdvanceTransition } from '@/features/goals/stage';
import { advanceGoalStageAction } from '@/features/goals/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StageTimeline } from './stage-timeline';
import { GoalForm } from './goal-form';
import { ReviewForm } from './review-form';
import { EvidenceUpload } from './evidence-upload';
import { parseGoalSettingDetails } from '@/features/goals/setting-schema';
import { SubmitGoal } from './submit-goal';

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

export async function GoalCard({
  goal,
  viewer,
  stageLabels,
}: {
  goal: GoalWithDetail;
  viewer: 'mentee' | 'mentor';
  stageLabels: Record<GoalStage, string>;
}) {
  const t = await getTranslations('goals');

  const editable = goal.status === GoalStatus.DRAFT || goal.status === GoalStatus.REJECTED;
  const setting = goal.settingDetails ? parseGoalSettingDetails(goal.settingDetails) : null;
  const advanceOptions =
    viewer === 'mentee'
      ? MENTEE_WORKING_STAGES.filter(
          (s) =>
            s !== goal.stage &&
            menteeAdvanceTransition({ status: goal.status, stage: goal.stage }, s),
        )
      : [];
  const canAddEvidence =
    viewer === 'mentee' &&
    (goal.status === GoalStatus.APPROVED || goal.status === GoalStatus.COMPLETED);
  const awaitingReview = viewer === 'mentor' && goal.status === GoalStatus.SUBMITTED;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="max-w-full min-w-0 text-base [overflow-wrap:anywhere]">
            {goal.title}
          </CardTitle>
          <div className="flex max-w-full min-w-0 flex-wrap gap-1 [&>*]:max-w-full [&>*]:[overflow-wrap:anywhere]">
            <Badge
              variant={
                goal.status === GoalStatus.APPROVED || goal.status === GoalStatus.COMPLETED
                  ? 'default'
                  : 'secondary'
              }
            >
              {t(`status.${goal.status}`)}
            </Badge>
            {goal.competency ? <Badge variant="outline">{goal.competency}</Badge> : null}
          </div>
        </div>
        <StageTimeline stage={goal.stage} labels={stageLabels} />
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {goal.whyMatters ? <Detail label={t('whyMatters')} value={goal.whyMatters} /> : null}
          {goal.successMeasure ? (
            <Detail label={t('successMeasure')} value={goal.successMeasure} />
          ) : null}
          {goal.learningActivity ? (
            <Detail label={t('learningActivity')} value={goal.learningActivity} />
          ) : null}
          {goal.currentLevel ? (
            <Detail label={t('currentLevel')} value={goal.currentLevel} />
          ) : null}
          {goal.desiredLevel ? (
            <Detail label={t('desiredLevel')} value={goal.desiredLevel} />
          ) : null}
          {goal.endDate ? <Detail label={t('endDate')} value={fmtDate(goal.endDate)} /> : null}
        </dl>
        {setting ? (
          <section className="bg-muted/30 space-y-2 rounded-md p-3">
            <h3 className="font-semibold">Goal-setting plan</h3>
            <dl className="space-y-2 text-sm">
              {Object.entries({
                Mentee: setting.menteeName,
                Mentor: setting.mentorName,
                Batch: setting.batch,
                'Department / unit': setting.department,
                'Goal-setting session': setting.sessionDate,
                'Mentor support': setting.support.join(', '),
                'Other support': setting.supportOther,
                'Potential challenges': setting.challenges,
                Commitment: setting.commitment,
                'Review frequency': setting.reviewFrequency,
                'Next review': setting.nextReviewDate,
                'Mentee sign-off': setting.accepted ? setting.signedDate : 'Not yet confirmed',
                'Mentor sign-off': goal.approvedAt
                  ? fmtDate(goal.approvedAt)
                  : 'Awaiting mentor approval',
              }).map(([label, value]) =>
                value ? <Detail key={label} label={label} value={value} /> : null,
              )}
            </dl>
          </section>
        ) : null}

        {goal.reviews.length > 0 ? (
          <div className="bg-muted/30 space-y-1 rounded border p-2">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t('mentorFeedback')}
            </p>
            {goal.reviews.map((r) => (
              <div key={r.id} className="text-sm">
                {r.comment ? (
                  <p>{r.comment}</p>
                ) : (
                  <p className="text-muted-foreground italic">{t('noComment')}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  {r.reviewer.name ?? '—'} · {fmtDate(r.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {goal.evidenceFiles.length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase">{t('evidence')}</p>
            <ul className="space-y-1">
              {goal.evidenceFiles.map((e) => (
                <li key={e.id} className="text-sm">
                  <a
                    className="text-primary underline"
                    href={`/api/goals/evidence/${e.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.fileName}
                  </a>
                  {e.note ? <span className="text-muted-foreground"> — {e.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Mentee controls */}
        {viewer === 'mentee' && editable ? (
          <div className="space-y-2 border-t pt-3">
            <details>
              <summary className="cursor-pointer text-sm font-medium">{t('editGoal')}</summary>
              <div className="pt-3">
                <GoalForm
                  mode="edit"
                  goalId={goal.id}
                  extended={Boolean(setting)}
                  initial={{
                    title: goal.title,
                    competency: goal.competency,
                    whyMatters: goal.whyMatters,
                    currentLevel: goal.currentLevel,
                    desiredLevel: goal.desiredLevel,
                    learningActivity: goal.learningActivity,
                    successMeasure: goal.successMeasure,
                    startDate: goal.startDate ? fmtDate(goal.startDate) : '',
                    endDate: goal.endDate ? fmtDate(goal.endDate) : '',
                    settingDetails: goal.settingDetails ? JSON.stringify(goal.settingDetails) : '',
                  }}
                />
              </div>
            </details>
            <SubmitGoal goalId={goal.id} label={t('submitForReview')} />
          </div>
        ) : null}

        {viewer === 'mentee' && goal.status === GoalStatus.SUBMITTED ? (
          <p className="text-muted-foreground border-t pt-3 text-sm">{t('awaitingReview')}</p>
        ) : null}

        {advanceOptions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-muted-foreground text-sm">{t('updateProgress')}:</span>
            {advanceOptions.map((s) => (
              <form key={s} action={advanceGoalStageAction}>
                <input type="hidden" name="goalId" value={goal.id} />
                <input type="hidden" name="stage" value={s} />
                <Button type="submit" size="sm" variant="outline">
                  {stageLabels[s]}
                </Button>
              </form>
            ))}
          </div>
        ) : null}

        {canAddEvidence ? <EvidenceUpload goalId={goal.id} /> : null}

        {/* Mentor controls */}
        {awaitingReview ? <ReviewForm goalId={goal.id} /> : null}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs font-medium uppercase">{label}</dt>
      <dd className="[overflow-wrap:anywhere] whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
