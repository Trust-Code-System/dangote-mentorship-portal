import { GoalStatus } from '@prisma/client';
import { stageProgressPercent } from '@/features/goals/stage';
import type { PairWorkspace } from './data';

export function pairProgress(pair: PairWorkspace) {
  const agreementsSigned = ['MENTORING', 'CONFIDENTIALITY'].every((type) => {
    const agreement = pair.agreements.find((entry) => entry.type === type);
    return Boolean(agreement?.mentorSignedAt && agreement.menteeSignedAt);
  });
  const goalsSet = pair.goals.some(
    (goal) =>
      goal.status === GoalStatus.SUBMITTED ||
      goal.status === GoalStatus.APPROVED ||
      goal.status === GoalStatus.COMPLETED,
  );
  const approved = pair.goals.some(
    (goal) => goal.status === GoalStatus.APPROVED || goal.status === GoalStatus.COMPLETED,
  );
  const goalsCompleted =
    goalsSet && pair.goals.every((goal) => goal.status === GoalStatus.COMPLETED);
  const actionsCompleted =
    pair.sessionCount > 0 &&
    pair.openActionItems.length === 0 &&
    (pair.totalActionCount > 0 || goalsCompleted);
  const steps = [
    {
      key: 'agreement',
      label: 'Agreement',
      completed: agreementsSigned,
      href: '/agreements',
      hint: 'Both partners sign the mentoring and confidentiality agreements.',
    },
    {
      key: 'goals',
      label: 'Goal setting',
      completed: goalsSet,
      href: '/goals',
      hint: 'Submit a development goal for your partnership.',
    },
    {
      key: 'growth',
      label: 'Growth plan',
      completed: approved,
      href: '/goals',
      hint: 'Review and approve a development goal together.',
    },
    {
      key: 'actions',
      label: 'Action plan',
      completed: actionsCompleted,
      href: '/sessions',
      hint: 'Log your sessions and complete the agreed action items.',
    },
    {
      key: 'closure',
      label: 'Closure',
      completed: pair.certificateEarned,
      href: '/certificate',
      hint: 'Complete the programme requirements and receive certificate approval.',
    },
  ];
  return {
    steps,
    current: steps.find((step) => !step.completed) ?? null,
    progressPercent: Math.round(
      (steps.filter((step) => step.completed).length / steps.length) * 100,
    ),
    topGoalPercent: pair.goals[0] ? stageProgressPercent(pair.goals[0].stage) : 0,
  };
}
