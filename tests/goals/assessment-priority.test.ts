import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/rbac';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ goal: vi.fn(), assessment: vi.fn() }));
vi.mock('@/lib/auth/rbac', () => ({ ForbiddenError: class extends Error {} }));
vi.mock('@/features/assessments/data', () => ({ getAssessmentGate: mocks.assessment }));
vi.mock('@/features/goals/onboarding', () => ({ getGoalSetupGate: mocks.goal }));
const { requirePortalAccess } = await import('@/features/assessments/guard');
const user = { id: 'mentee-1' } as SessionUser;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.goal.mockResolvedValue({ locked: true });
  mocks.assessment.mockResolvedValue({ locked: true });
});
describe('setup and assessment lock precedence', () => {
  it('allows first-goal setup even with an overdue assessment', async () => {
    await expect(requirePortalAccess(user, { allowGoalSetup: true })).resolves.toBeUndefined();
    expect(mocks.assessment).not.toHaveBeenCalled();
  });
  it('keeps ordinary actions subject to the assessment lock', async () => {
    await expect(requirePortalAccess(user)).rejects.toThrow('quarterly assessment is overdue');
  });
  it('restores assessment enforcement for goal actions after setup', async () => {
    mocks.goal.mockResolvedValue({ locked: false });
    await expect(requirePortalAccess(user, { allowGoalSetup: true })).rejects.toThrow(
      'quarterly assessment is overdue',
    );
  });
});
