import { getTranslations } from 'next-intl/server';
import { GoalStage, RoleName } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
import { getMenteeGoals, getGoalsForMentor } from '@/features/goals/data';
import { getDraft } from '@/features/drafts/data';
import { GOAL_STAGE_ORDER } from '@/features/goals/stage';
import type { GoalDraftFields } from '@/features/goals/smart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GoalForm } from './goal-form';
import { GoalCard } from './goal-card';
import { getGoalSetupGate, resolveGoalCohortId } from '@/features/goals/onboarding';

export default async function GoalsPage() {
  const user = await requireUser({ allowGoalSetup: true });
  const t = await getTranslations('goals');

  const stageLabels = Object.fromEntries(
    GOAL_STAGE_ORDER.map((s) => [s, t(`stage.${s}`)]),
  ) as Record<GoalStage, string>;

  const isMentor = user.roles.includes(RoleName.MENTOR);
  const isMentee = user.roles.includes(RoleName.MENTEE);

  const [cohortId, menteeGoals, mentorGroups, setup] = await Promise.all([
    isMentee ? resolveGoalCohortId(user.id) : Promise.resolve(null),
    isMentee ? getMenteeGoals(user.id) : Promise.resolve([]),
    isMentor ? getGoalsForMentor(user.id) : Promise.resolve([]),
    getGoalSetupGate(user),
  ]);

  const newGoalDraft =
    isMentee && cohortId ? await getDraft<GoalDraftFields>(user.id, 'goal:new') : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-h1 text-ink font-bold">{t('title')}</h1>
        <p className="text-body text-ink-2">{setup.locked ? t('setupRequired') : t('subtitle')}</p>
      </div>

      {/* Mentee view — Stitch 2-column: create card left, active goals right */}
      {isMentee ? (
        !cohortId ? (
          <p className="text-ink-3">{t('setupNoCohort')}</p>
        ) : (
          <div
            className={
              setup.locked
                ? 'mx-auto max-w-2xl'
                : 'grid items-start gap-5 lg:grid-cols-[1.1fr_.9fr]'
            }
          >
            <Card className="self-start">
              <CardHeader>
                <CardTitle className="text-h2">{t('newGoal')}</CardTitle>
              </CardHeader>
              <CardContent>
                <GoalForm
                  mode="create"
                  cohortId={cohortId}
                  onboarding={setup.locked}
                  initial={newGoalDraft ?? undefined}
                  enableDraft
                />
              </CardContent>
            </Card>

            {!setup.locked ? (
              <section className="space-y-4">
                <h2 className="font-display text-h2 text-ink">{t('myGoals')}</h2>
                {menteeGoals.length === 0 ? (
                  <p className="text-ink-3">{t('noGoalsMentee')}</p>
                ) : (
                  <div className="space-y-4">
                    {menteeGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        viewer="mentee"
                        stageLabels={stageLabels}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        )
      ) : null}

      {/* Mentor view */}
      {isMentor && !setup.locked ? (
        <section className="space-y-4">
          <h2 className="font-display text-h2 text-ink">{t('menteeGoals')}</h2>
          {mentorGroups.length === 0 ? (
            <p className="text-muted-foreground">{t('noPairings')}</p>
          ) : (
            mentorGroups.map((group) => (
              <div key={group.mentee.menteeId} className="space-y-3">
                <h3 className="font-medium">{group.mentee.menteeName}</h3>
                {group.goals.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('noGoalsMentor')}</p>
                ) : (
                  group.goals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} viewer="mentor" stageLabels={stageLabels} />
                  ))
                )}
              </div>
            ))
          )}
        </section>
      ) : null}

      {!isMentee && !isMentor ? <p className="text-muted-foreground">{t('noAccess')}</p> : null}
    </div>
  );
}
