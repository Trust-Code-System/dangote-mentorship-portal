import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const create = vi.fn();
const getMentorPairings = vi.fn();
const getMenteePairing = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversation: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

vi.mock('@/lib/pairings', () => ({
  getMentorPairings: (...args: unknown[]) => getMentorPairings(...args),
  getMenteePairing: (...args: unknown[]) => getMenteePairing(...args),
}));

describe('ensureDirectConversations', () => {
  beforeEach(() => {
    vi.resetModules();
    findFirst.mockReset();
    create.mockReset();
    getMentorPairings.mockReset();
    getMenteePairing.mockReset();
  });

  it('does not throw when a concurrent create races and the conversation appears', async () => {
    getMentorPairings.mockResolvedValue([{ cohortId: 'c1', menteeId: 'mentee-1', menteeName: 'A' }]);
    getMenteePairing.mockResolvedValue(null);

    // First lookup: missing. Create fails (race). Second lookup: present.
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'convo-1' });
    create.mockRejectedValueOnce(new Error('Unique constraint'));

    const { ensureDirectConversations } = await import('@/features/messages/data');
    await expect(ensureDirectConversations('mentor-1')).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
  });

  it('rethrows when create fails and the conversation is still missing', async () => {
    getMentorPairings.mockResolvedValue([{ cohortId: 'c1', menteeId: 'mentee-1', menteeName: 'A' }]);
    getMenteePairing.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    create.mockRejectedValueOnce(new Error('connection reset'));

    const { ensureDirectConversations } = await import('@/features/messages/data');
    await expect(ensureDirectConversations('mentor-1')).rejects.toThrow('connection reset');
  });
});
