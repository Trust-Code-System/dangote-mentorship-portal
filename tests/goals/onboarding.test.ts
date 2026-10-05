import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleName } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/rbac';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  pairing: vi.fn(),
  grant: vi.fn(),
  profile: vi.fn(),
  goal: vi.fn(),
}));
vi.mock('@/lib/pairings', () => ({ getMenteePairing: mocks.pairing }));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    userRole: { findFirst: mocks.grant },
    menteeProfile: { findFirst: mocks.profile },
    goal: { findFirst: mocks.goal },
  },
}));
const { getGoalSetupGate, resolveGoalCohortId } = await import('@/features/goals/onboarding');
const user: SessionUser = {
  id: 'mentee-1',
  email: 'mentee@example.com',
  roles: [RoleName.MENTEE],
  image: null,
  adminCohortScope: [],
  locale: 'EN',
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pairing.mockResolvedValue(null);
  mocks.grant.mockResolvedValue({ cohortId: 'cohort-1' });
  mocks.profile.mockResolvedValue(null);
  mocks.goal.mockResolvedValue(null);
});

describe('first-goal setup', () => {
  it('locks an enrolled mentee with no goal, even before they have a mentor', async () => {
    expect(await getGoalSetupGate(user)).toEqual({ locked: true, cohortId: 'cohort-1' });
  });
  it('unlocks after a real goal is saved without requiring mentor approval', async () => {
    mocks.goal.mockResolvedValue({ id: 'saved-draft-goal' });
    expect((await getGoalSetupGate(user)).locked).toBe(false);
    expect(mocks.goal).toHaveBeenCalledWith({
      where: { menteeId: user.id, cohortId: 'cohort-1', deletedAt: null },
      select: { id: true },
    });
  });
  it.each([[RoleName.MENTOR], [RoleName.SUPER_ADMIN], [RoleName.MENTEE, RoleName.SUPER_ADMIN]])(
    'does not lock role set %s',
    async (...roles) => {
      expect((await getGoalSetupGate({ ...user, roles })).locked).toBe(false);
      expect(mocks.goal).not.toHaveBeenCalled();
    },
  );
  it('keeps a mentee without a cohort on setup rather than granting full access', async () => {
    mocks.grant.mockResolvedValue(null);
    expect(await getGoalSetupGate(user)).toEqual({ locked: true, cohortId: null });
    expect(mocks.goal).not.toHaveBeenCalled();
  });
  it('uses the accepted pairing cohort ahead of role grants', async () => {
    mocks.pairing.mockResolvedValue({ cohortId: 'paired-cohort' });
    expect(await resolveGoalCohortId(user.id)).toBe('paired-cohort');
    expect(mocks.grant).not.toHaveBeenCalled();
  });
  it('uses an enrolled profile for globally granted mentees', async () => {
    mocks.grant.mockResolvedValue(null);
    mocks.profile.mockResolvedValue({ cohortId: 'profile-cohort' });
    expect(await resolveGoalCohortId(user.id)).toBe('profile-cohort');
    expect(mocks.profile).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id, deletedAt: null, cohort: { deletedAt: null } },
      }),
    );
  });
});
