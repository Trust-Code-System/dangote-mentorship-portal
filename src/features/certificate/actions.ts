'use server';

import { revalidatePath } from 'next/cache';
import { revalidateMentorshipProgress } from '@/features/journey/revalidate';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRole, assertCohortAccess } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { fail, mapActionError, ok } from '@/lib/actions/result';
import { getCertificateForViewer } from './data';

const permissionSchema = z.object({
  matchId: z.string().cuid(),
  decision: z.enum(['approve', 'revoke']),
});

export async function setMenteeCertificatePermission(formData: FormData) {
  try {
    const admin = await requireRole(ADMIN_ROLES);
    const input = permissionSchema.parse({
      matchId: formData.get('matchId'),
      decision: formData.get('decision'),
    });
    const certificate = await getCertificateForViewer(admin, input.matchId, 'mentee');
    if (!certificate) return fail({ code: 'NOT_FOUND', message: 'Certificate not found.' });
    assertCohortAccess(admin, certificate.cohortId);
    const approved = input.decision === 'approve';
    if (approved && !certificate.requirementsMet)
      return fail({
        code: 'CONFLICT',
        message: 'The programme requirements must be completed before approving release.',
      });

    await prisma.$transaction(async (tx) => {
      const result = await tx.match.updateMany({
        where: {
          id: input.matchId,
          cohortId: certificate.cohortId,
          menteeId: certificate.recipientId,
          status: 'ACCEPTED',
          deletedAt: null,
        },
        data: {
          menteeCertificateApprovedAt: approved ? new Date() : null,
          menteeCertificateApprovedById: approved ? admin.id : null,
        },
      });
      if (result.count !== 1) throw new Error('The accepted pairing is no longer available.');
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          cohortId: certificate.cohortId,
          action: approved
            ? 'certificate.mentee_release_approved'
            : 'certificate.mentee_release_revoked',
          entityType: 'Match',
          entityId: input.matchId,
          metadata: {
            recipientId: certificate.recipientId,
            previousApprovedAt: certificate.adminApprovedAt?.toISOString() ?? null,
          },
        },
      });
    });
    revalidatePath('/admin/certificates');
    revalidateMentorshipProgress();
    revalidatePath('/certificate');
    revalidatePath('/dashboard/mentee');
    return ok({ approved });
  } catch (error) {
    return mapActionError(error);
  }
}
