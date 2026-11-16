import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  role: vi.fn(),
  scope: vi.fn(),
  data: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/rbac', () => ({ requireRole: m.role, assertCohortAccess: m.scope }));
vi.mock('@/features/certificate/data', () => ({ getCertificateForViewer: m.data }));
vi.mock('@/lib/actions/result', () => ({
  ok: (data: unknown) => ({ ok: true, data }),
  fail: (error: unknown) => ({ ok: false, error }),
  mapActionError: () => ({ ok: false, error: { code: 'FORBIDDEN' } }),
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ match: { updateMany: m.update }, auditLog: { create: m.audit } }),
  },
}));
import { setMenteeCertificatePermission } from '@/features/certificate/actions';
const matchId = 'cmwixp7uh0002fi8g8u0june4';
const form = (decision: string) => {
  const f = new FormData();
  f.set('matchId', matchId);
  f.set('decision', decision);
  return f;
};
beforeEach(() => {
  vi.clearAllMocks();
  m.role.mockResolvedValue({ id: 'admin' });
  m.scope.mockImplementation(() => {});
  m.data.mockResolvedValue({
    cohortId: 'cohort',
    recipientId: 'mentee',
    requirementsMet: true,
    adminApprovedAt: null,
  });
  m.update.mockResolvedValue({ count: 1 });
});
it('rejects a participant attempting to approve themselves', async () => {
  m.role.mockRejectedValue(new Error('Forbidden'));
  expect((await setMenteeCertificatePermission(form('approve'))).ok).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
  expect(m.data).not.toHaveBeenCalled();
});
it('rejects an admin outside the cohort even when the admin owns the certificate', async () => {
  m.scope.mockImplementation(() => {
    throw new Error('Forbidden');
  });
  expect((await setMenteeCertificatePermission(form('approve'))).ok).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('cannot approve incomplete programme requirements', async () => {
  m.data.mockResolvedValue({ cohortId: 'cohort', requirementsMet: false });
  expect((await setMenteeCertificatePermission(form('approve'))).ok).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('records the approving actor and audits release in the same transaction', async () => {
  expect((await setMenteeCertificatePermission(form('approve'))).ok).toBe(true);
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: matchId,
        cohortId: 'cohort',
        menteeId: 'mentee',
        status: 'ACCEPTED',
      }),
      data: {
        menteeCertificateApprovedAt: expect.any(Date),
        menteeCertificateApprovedById: 'admin',
      },
    }),
  );
  expect(m.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        actorId: 'admin',
        action: 'certificate.mentee_release_approved',
      }),
    }),
  );
});
it('revokes both approval fields even if programme completion has since changed', async () => {
  m.data.mockResolvedValue({
    cohortId: 'cohort',
    recipientId: 'mentee',
    requirementsMet: false,
    adminApprovedAt: new Date(),
  });
  expect((await setMenteeCertificatePermission(form('revoke'))).ok).toBe(true);
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { menteeCertificateApprovedAt: null, menteeCertificateApprovedById: null },
    }),
  );
  expect(m.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ action: 'certificate.mentee_release_revoked' }),
    }),
  );
});
