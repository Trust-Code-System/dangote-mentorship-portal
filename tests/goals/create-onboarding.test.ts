import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleName } from '@prisma/client';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  access: vi.fn(),
  cohort: vi.fn(),
  create: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/auth/rbac', () => ({
  requireUser: mocks.user,
  ForbiddenError: class extends Error {},
  UnauthenticatedError: class extends Error {},
}));
vi.mock('@/features/assessments/guard', () => ({ requirePortalAccess: mocks.access }));
vi.mock('@/features/goals/onboarding', () => ({ resolveGoalCohortId: mocks.cohort }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { goal: { create: mocks.create } } }));
vi.mock('@/lib/audit/audit', () => ({ writeAuditLog: mocks.audit }));
vi.mock('@/lib/notifications/notify', () => ({ notify: vi.fn() }));
vi.mock('@/lib/storage', () => ({ getStorageProvider: vi.fn() }));
vi.mock('@/lib/storage/direct', () => ({
  canUseDirectUploads: vi.fn(),
  createSignedUploadTarget: vi.fn(),
  removeStoredObject: vi.fn(),
}));
vi.mock('@/lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('@/lib/auth/rate-limit-shared', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/features/goals/coach', () => ({ coachGoal: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next-intl/server', () => ({ getLocale: vi.fn() }));
const { saveGoal } = await import('@/features/goals/actions');

function form(title = 'Develop leadership skills') {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    title,
    competency: 'Leadership',
    whyMatters: 'Lead my team',
    currentLevel: '',
    desiredLevel: '',
    learningActivity: 'Practice with a mentor',
    successMeasure: 'Lead two team meetings',
    startDate: '2026-10-01',
    endDate: '2026-12-01',
    cohortId: 'untrusted-other-cohort',
  }))
    data.set(name, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: 'mentee-1', roles: [RoleName.MENTEE] });
  mocks.access.mockResolvedValue(undefined);
  mocks.cohort.mockResolvedValue('own-cohort');
  mocks.create.mockResolvedValue({ id: 'new-goal' });
});
describe('first goal creation', () => {
  it('creates a goal before pairing, using the server-resolved cohort', async () => {
    expect(await saveGoal(form())).toEqual({ ok: true, data: { id: 'new-goal' } });
    expect(mocks.user).toHaveBeenCalledWith({ allowGoalSetup: true });
    expect(mocks.access).toHaveBeenCalledWith(expect.anything(), { allowGoalSetup: true });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cohortId: 'own-cohort',
        menteeId: 'mentee-1',
        status: 'DRAFT',
        title: 'Develop leadership skills',
      }),
    });
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout');
  });
  it('does not persist invalid input or clear the setup gate', async () => {
    expect(await saveGoal(form(''))).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('does not create a goal without verified cohort membership', async () => {
    mocks.cohort.mockResolvedValue(null);
    expect(await saveGoal(form())).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not let mentor-only accounts create mentee goals', async () => {
    mocks.user.mockResolvedValue({ id: 'mentor-1', roles: [RoleName.MENTOR] });
    expect(await saveGoal(form())).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
