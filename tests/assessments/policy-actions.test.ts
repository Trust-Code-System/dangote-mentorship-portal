import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  enabled: vi.fn(),
  user: vi.fn(),
  window: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/rbac', () => ({
  requireUser: m.user,
  requireRole: m.user,
  assertCohortAccess: vi.fn(),
  ForbiddenError: class extends Error {},
  UnauthenticatedError: class extends Error {},
}));
vi.mock('@/lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('@/lib/audit/audit', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/features/forms/data', () => ({ getFormDefinition: vi.fn() }));
vi.mock('@/features/assessments/data', () => ({
  resolveParticipantCohortId: async () => 'cmwcohort00000000000000001',
}));
vi.mock('@/features/assessments/policy', () => ({
  quarterlyAssessmentsEnabled: m.enabled,
  recurringFormEnabled: m.enabled,
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    assessmentWindow: { findFirst: m.window, update: m.update },
    formResponse: { create: m.create },
  },
}));
import {
  submitAssessment,
  generateAssessmentWindows,
  updateAssessmentWindow,
  setAssessmentWindowActive,
} from '@/features/assessments/actions';
const fd = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ id: 'user', roles: ['MENTEE'] });
  m.enabled.mockResolvedValue(false);
  m.window.mockResolvedValue({
    id: 'cmwwindow0000000000000001',
    cohortId: 'cmwcohort00000000000000001',
    formType: 'QUARTERLY',
    opensAt: new Date('2020-01-01'),
  });
});
it('rejects a direct quarterly submission even if an old window remains active', async () => {
  const result = await submitAssessment(
    fd({
      formId: 'cmwform000000000000000001',
      windowId: 'cmwwindow0000000000000001',
      answers: '{}',
    }),
  );
  expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  expect(m.create).not.toHaveBeenCalled();
});
it('blocks generating new quarterly obligations for an opted-out stream', async () => {
  expect(
    await generateAssessmentWindows(
      fd({ cohortId: 'cmwcohort00000000000000001', intervalMonths: '3', graceDays: '7' }),
    ),
  ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
});
it('blocks reactivation through either admin action', async () => {
  const values = {
    windowId: 'cmwwindow0000000000000001',
    isActive: 'true',
    label: 'Quarter 1',
    opensAt: '2020-01-01',
    dueAt: '2020-02-01',
    graceDays: '7',
  };
  expect(await setAssessmentWindowActive(fd(values))).toMatchObject({
    ok: false,
    error: { code: 'FORBIDDEN' },
  });
  expect(await updateAssessmentWindow(fd(values))).toMatchObject({
    ok: false,
    error: { code: 'FORBIDDEN' },
  });
  expect(m.update).not.toHaveBeenCalled();
});
