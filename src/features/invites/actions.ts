'use server';

import { revalidatePath } from 'next/cache';
import { InviteStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole, hasAnyRole, canAccessCohort } from '@/lib/auth/rbac';
import { RoleName, ADMIN_ROLES } from '@/lib/auth/roles';
import { generateInviteToken, inviteExpiry } from '@/lib/auth/invite';
import { writeAuditLog } from '@/lib/audit/audit';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { createInviteSchema, revokeInviteSchema } from './schema';

// Invite creation (CLAUDE.md §2: admin-created accounts + invite links).
// The raw token is returned exactly once; only its hash is persisted, so the
// link can never be reconstructed later (see lib/auth/invite.ts).

export async function createInvite(
  formData: FormData,
): Promise<ActionResult<{ id: string; token: string }>> {
  try {
    const actor = await requireRole(ADMIN_ROLES);
    const data = createInviteSchema.parse({
      email: formData.get('email'),
      roleName: formData.get('roleName'),
      cohortId: formData.get('cohortId') ?? undefined,
    });

    // §4: user management is Super-Admin full / Programme-Admin partial —
    // a Programme Admin may invite participants but never another admin.
    const invitingAdmin = ADMIN_ROLES.includes(data.roleName);
    if (invitingAdmin && !hasAnyRole(actor, RoleName.SUPER_ADMIN)) {
      return fail({
        code: 'FORBIDDEN',
        message: 'Only a Super Admin can invite administrators.',
      });
    }

    // A cohort-scoped admin may only invite within a cohort they administer —
    // never a different cohort, and never a global (cohort-less) grant, which
    // would hand the invitee reach the inviting admin doesn't have themselves.
    if (
      actor.adminCohortScope !== 'ALL' &&
      (!data.cohortId || !canAccessCohort(actor, data.cohortId))
    ) {
      return fail({
        code: 'FORBIDDEN',
        message: 'You may only invite within a cohort you administer.',
      });
    }

    const existing = await prisma.invite.findFirst({
      where: {
        email: data.email,
        roleName: data.roleName,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });
    if (existing) {
      return fail({
        code: 'CONFLICT',
        message: 'An active invite already exists for this email and role.',
      });
    }

    const { token, tokenHash } = generateInviteToken();
    const invite = await prisma.invite.create({
      data: {
        email: data.email,
        roleName: data.roleName,
        cohortId: data.cohortId,
        tokenHash,
        expiresAt: inviteExpiry(),
        invitedById: actor.id,
      },
    });
    await writeAuditLog({
      actorId: actor.id,
      cohortId: data.cohortId,
      action: 'invite.created',
      entityType: 'Invite',
      entityId: invite.id,
      metadata: { email: data.email, roleName: data.roleName },
    });

    revalidatePath('/admin/invites');
    return ok({ id: invite.id, token });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function revokeInvite(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(ADMIN_ROLES);
    const { id } = revokeInviteSchema.parse({ id: formData.get('id') });

    const invite = await prisma.invite.findFirst({ where: { id, deletedAt: null } });
    if (!invite) {
      return fail({ code: 'NOT_FOUND', message: 'Invite not found.' });
    }
    if (invite.status !== InviteStatus.PENDING) {
      return fail({ code: 'CONFLICT', message: 'Only pending invites can be revoked.' });
    }

    await prisma.invite.update({
      where: { id },
      data: { status: InviteStatus.REVOKED },
    });
    await writeAuditLog({
      actorId: actor.id,
      cohortId: invite.cohortId,
      action: 'invite.revoked',
      entityType: 'Invite',
      entityId: id,
      metadata: { email: invite.email, roleName: invite.roleName },
    });

    revalidatePath('/admin/invites');
    return ok({ id });
  } catch (error) {
    return mapActionError(error);
  }
}
