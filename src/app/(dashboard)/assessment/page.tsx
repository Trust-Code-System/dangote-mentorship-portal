import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AssessmentScreen } from '@/features/assessments/assessment-screen';

// The mandatory every-3-months mentee assessment. Reachable even while the
// portal is locked (features/assessments/gate.ts allowlist) — it is the only
// way out of the lock.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('assessments');
  return { title: t('title') };
}

export default function AssessmentPage() {
  return <AssessmentScreen />;
}
