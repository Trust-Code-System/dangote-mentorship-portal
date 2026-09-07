import { ReportDetailScreen } from '@/features/reports/report-detail-screen';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetailScreen reportId={id} basePath="/reports" />;
}
