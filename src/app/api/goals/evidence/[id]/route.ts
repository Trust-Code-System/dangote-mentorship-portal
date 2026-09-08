import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, hasAnyRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getStorageProvider } from '@/lib/storage';
import { isMentorOfGoal } from '@/features/goals/data';

// Streams a goal-evidence file. Outside the auth middleware matcher (/api), so
// authorization is enforced here: the mentee who uploaded it, their paired
// mentor, or a programme admin — never a public URL (CLAUDE.md §4, §14).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const evidence = await prisma.goalEvidence.findUnique({
    where: { id },
    include: { goal: true },
  });

  if (!evidence || evidence.deletedAt || evidence.goal.deletedAt) {
    return new Response('Not found', { status: 404 });
  }

  const isUploader = evidence.uploadedById === user.id;
  const isAdmin = hasAnyRole(user, ADMIN_ROLES);
  const isMentor = !isUploader && !isAdmin && (await isMentorOfGoal(user.id, evidence.goal));
  if (!isUploader && !isAdmin && !isMentor) {
    return new Response('Forbidden', { status: 403 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await getStorageProvider().get(evidence.url);
  } catch {
    return new Response('File unavailable', { status: 404 });
  }

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': evidence.mimeType ?? 'application/octet-stream',
      // `attachment` (not `inline`) so a forged file can never be rendered as a
      // top-level document in our origin (production-readiness-report.md M1).
      'content-disposition': `attachment; filename="${encodeURIComponent(evidence.fileName)}"`,
      'cache-control': 'private, no-store',
    },
  });
}
