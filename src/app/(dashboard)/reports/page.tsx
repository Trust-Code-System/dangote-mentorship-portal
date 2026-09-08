import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReportsScreen } from '@/features/reports/reports-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reports');
  return { title: t('title') };
}

export default function ReportsPage() {
  return <ReportsScreen basePath="/reports" />;
}
