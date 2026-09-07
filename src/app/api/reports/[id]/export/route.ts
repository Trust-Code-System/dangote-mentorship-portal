import { getFormatter } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { getReadableReport } from '@/features/reports/data';
import { renderReportDocx } from '@/features/reports/docx';
import { renderReportXlsx } from '@/features/reports/xlsx';
import { exportFilename, isExportFormat } from '@/features/reports/schema';

// Streams a saved report as Word (.docx) or Excel (.xlsx).
//
// This route sits OUTSIDE the edge auth matcher (which excludes /api), so it
// authorizes here: getReadableReport() returns null unless the caller is the
// author or an admin within their cohort scope (CLAUDE.md §4, §14 — a report
// can quote goal text and mentor commentary, so it is never a public URL).
//
// The Node runtime is required: both writers are Node-only (docx uses Buffer,
// SheetJS writes a Buffer).
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const format = new URL(request.url).searchParams.get('format') ?? 'docx';
  if (!isExportFormat(format)) {
    return new Response('Unsupported format', { status: 400 });
  }

  const { id } = await params;
  const report = await getReadableReport(user, id);
  // Same response for "missing" and "not yours": an export URL must not confirm
  // that someone else's report exists.
  if (!report) return new Response('Not found', { status: 404 });
  if (!report.content) return new Response('Report content unavailable', { status: 409 });

  const formatter = await getFormatter();
  const meta = {
    title: report.title,
    organisation: 'BLAK MOH Mentorship Programme',
    generatedOn: formatter.dateTime(new Date(), { dateStyle: 'long' }),
    author: report.authorName ?? user.email,
  };

  const body =
    format === 'docx'
      ? await renderReportDocx(report.content, meta)
      : renderReportXlsx(report.content, meta);

  await writeAuditLog({
    actorId: user.id,
    cohortId: report.cohortId,
    action: 'report.exported',
    entityType: 'Report',
    entityId: report.id,
    metadata: { format, bytes: body.byteLength },
  });

  const contentType =
    format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${exportFilename(report.title, format)}"`,
      'cache-control': 'private, no-store',
    },
  });
}
