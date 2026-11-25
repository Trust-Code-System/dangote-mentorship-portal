import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AssessmentScreen } from '@/features/assessments/assessment-screen';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/rbac';
import { resolveParticipantCohortId } from '@/features/assessments/data';
import { quarterlyAssessmentsEnabled } from '@/features/assessments/policy';

// The mandatory every-3-months mentee assessment. Reachable even while the
// portal is locked (features/assessments/gate.ts allowlist) — it is the only
// way out of the lock.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('assessments');
  return { title: t('title') };
}

export default async function AssessmentPage() {
  const user = await requireUser();
  const cohortId = await resolveParticipantCohortId(user.id);
  if (cohortId && !(await quarterlyAssessmentsEnabled(cohortId))) redirect('/dashboard');
  return <AssessmentScreen />;
}
