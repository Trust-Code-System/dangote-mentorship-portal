import 'server-only';
import { CohortStatus, type SupportRequestReason, type SupportRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { adminCohortFilter, type SessionUser } from '@/lib/auth/rbac';
import type { SupportRequestView } from './queue';

// Reads for the private support queue (experience-layer.md §1.13). A request is
// anonymous to *other participants* — the programme team (admins) always sees who
// raised it. Content here is for admins by design (it is a help queue), unlike the
// DM/reflection posture.

export { countOpen, type SupportRequestView } from './queue';

/**
 * The cohort a support request belongs to. Prefers the requester's own profile
 * (mentee, then mentor); falls back to the active cohort so non-profile roles
 * (trainer/reviewer) can still raise a request.
 */
export async function getRequesterCohortId(userId: string): Promise<string | null> {
  const mentee = await prisma.menteeProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { cohortId: true },
  });
  if (mentee) return mentee.cohortId;

  const mentor = await prisma.mentorProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { cohortId: true },
  });
  if (mentor) return mentor.cohortId;

  const active = await prisma.cohort.findFirst({
    where: { status: CohortStatus.ACTIVE, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return active?.id ?? null;
}

function toView(row: {
  id: string;
  reason: SupportRequestReason;
  message: string | null;
  status: SupportRequestStatus;
  adminResponse: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  requester: { name: string | null; email: string };
  cohort: { name: string } | null;
  handledBy: { name: string | null } | null;
}): SupportRequestView {
  return {
    id: row.id,
    reason: row.reason,
    message: row.message,
    status: row.status,
    adminResponse: row.adminResponse,
    requesterName: row.requester.name,
    requesterEmail: row.requester.email,
    cohortName: row.cohort?.name ?? null,
    handledByName: row.handledBy?.name ?? null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

const detailInclude = {
  requester: { select: { name: true, email: true } },
  cohort: { select: { name: true } },
  handledBy: { select: { name: true } },
} as const;

/**
 * Admin queue: open requests first, then most recent. Confined to the cohorts the
 * calling admin may see (m2-audit-findings H1) — a global admin sees all.
 */
export async function getSupportQueue(admin: SessionUser): Promise<SupportRequestView[]> {
  const rows = await prisma.supportRequest.findMany({
    where: { deletedAt: null, ...adminCohortFilter(admin) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: detailInclude,
    take: 200,
  });
  return rows.map(toView);
}

/** Ids of every admin (Super/Programme) — recipients for the support queue alert. */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      deletedAt: null,
      userRoles: { some: { role: { name: { in: ADMIN_ROLES } } } },
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** A requester's own past requests (so they can read the admin's response). */
export async function getMyRequests(userId: string): Promise<SupportRequestView[]> {
  const rows = await prisma.supportRequest.findMany({
    where: { requesterId: userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: detailInclude,
    take: 50,
  });
  return rows.map(toView);
}
