import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { ReportDetailScreen } from '@/features/reports/report-detail-screen';

export default async function AdminReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(ADMIN_ROLES);
  const { id } = await params;
  return <ReportDetailScreen reportId={id} basePath="/admin/reports" />;
}
