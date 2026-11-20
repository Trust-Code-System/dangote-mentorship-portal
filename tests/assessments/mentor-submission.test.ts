import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  user: vi.fn(),
  window: vi.fn(),
  form: vi.fn(),
  existing: vi.fn(),
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
vi.mock('@/features/forms/data', () => ({ getFormDefinition: m.form }));
vi.mock('@/features/assessments/data', () => ({
  resolveParticipantCohortId: async () => 'cmwcohort00000000000000001',
}));
vi.mock('@/features/assessments/policy', () => ({
  quarterlyAssessmentsEnabled: async () => true,
  recurringFormEnabled: async () => true,
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    assessmentWindow: { findFirst: m.window },
    formResponse: { findFirst: m.existing, create: m.create, update: m.update },
  },
}));
import { submitAssessment } from '@/features/assessments/actions';
const cohortId = 'cmwcohort00000000000000001';
const formId = 'cmwform000000000000000001';
const windowId = 'cmwwindow0000000000000001';
function submission() {
  const data = new FormData();
  data.set('formId', formId);
  data.set('windowId', windowId);
  data.set('answers', JSON.stringify({ summary: 'A useful mentoring session' }));
  return data;
}
const form = {
  id: formId,
  cohortId,
  type: 'MONTHLY',
  roleName: 'MENTOR',
  isActive: true,
  schema: {
    fields: [
      { id: 'summary', labelEn: 'Summary', labelFr: 'Résumé', type: 'short_text', required: true },
    ],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ id: 'mentor-1', roles: ['MENTOR'] });
  m.window.mockResolvedValue({
    id: windowId,
    formType: 'MONTHLY',
    opensAt: new Date('2020-01-01'),
  });
  m.form.mockResolvedValue(form);
  m.existing.mockResolvedValue(null);
  m.create.mockResolvedValue({ id: 'response-1' });
  m.update.mockResolvedValue({ id: 'response-1' });
});
it('lets a mentor submit their own monthly form', async () => {
  expect(await submitAssessment(submission())).toMatchObject({ ok: true });
  expect(m.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        respondentId: 'mentor-1',
        formId,
        assessmentWindowId: windowId,
        status: 'SUBMITTED',
      }),
    }),
  );
});
it('updates only the same mentor response for the same window', async () => {
  m.existing.mockResolvedValue({ id: 'response-1' });
  expect(await submitAssessment(submission())).toMatchObject({ ok: true });
  expect(m.existing).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        respondentId: 'mentor-1',
        assessmentWindowId: windowId,
      }),
    }),
  );
  expect(m.update).toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it.each([
  ['mentee role', { roleName: 'MENTEE' }, 'FORBIDDEN'],
  ['another cohort', { cohortId: 'cmwother00000000000000001' }, 'NOT_FOUND'],
  ['another form type', { type: 'QUARTERLY' }, 'NOT_FOUND'],
  ['inactive definition', { isActive: false }, 'NOT_FOUND'],
])('rejects a monthly submission against %s', async (_name, changes, code) => {
  m.form.mockResolvedValue({ ...form, ...changes });
  expect(await submitAssessment(submission())).toMatchObject({ ok: false, error: { code } });
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it('keeps the window lookup scoped to the participant cohort', async () => {
  m.window.mockResolvedValue(null);
  expect(await submitAssessment(submission())).toMatchObject({ ok: false });
  expect(m.window).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: windowId,
        cohortId,
        isActive: true,
        deletedAt: null,
      }),
    }),
  );
  expect(m.create).not.toHaveBeenCalled();
});
