import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReviewType } from '@prisma/client';
import { AssessmentScreen } from '@/features/assessments/assessment-screen';

// The mentee's monthly meeting form: their own account of the month's
// session(s), alongside the mentor's session log. Unlike the quarterly
// assessment this never blocks the portal — missing it produces reminders
// (lib/notifications/cron.ts) and shows up in the newsletter.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('monthlyForm');
  return { title: t('title') };
}

export default function MonthlyFormPage() {
  return <AssessmentScreen formType={ReviewType.MONTHLY} />;
}
