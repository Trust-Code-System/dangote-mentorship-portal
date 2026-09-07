import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { ReportsScreen } from '@/features/reports/reports-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reports');
  return { title: t('title') };
}

export default async function AdminReportsPage() {
  await requireRole(ADMIN_ROLES);
  return <ReportsScreen basePath="/admin/reports" />;
}
