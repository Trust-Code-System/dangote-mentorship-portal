import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const updateMany = vi.fn();
const upsert = vi.fn();
const getMentorPairings = vi.fn();
const getMenteePairing = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversation: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      upsert: (...args: unknown[]) => upsert(...args),
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
    updateMany.mockReset();
    upsert.mockReset();
    getMentorPairings.mockReset();
    getMenteePairing.mockReset();
  });

  it('backfills a stable direct key on an existing legacy conversation', async () => {
    getMentorPairings.mockResolvedValue([{ cohortId: 'c1', menteeId: 'mentee-1', menteeName: 'A' }]);
    getMenteePairing.mockResolvedValue(null);
    findFirst.mockResolvedValueOnce({ id: 'convo-1' });
    updateMany.mockResolvedValueOnce({ count: 1 });

    const { ensureDirectConversations } = await import('@/features/messages/data');
    await expect(ensureDirectConversations('mentor-1')).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'convo-1', directKey: null },
      data: { directKey: 'c1:mentee-1:mentor-1' },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('uses an atomic upsert when the direct conversation is missing', async () => {
    getMentorPairings.mockResolvedValue([{ cohortId: 'c1', menteeId: 'mentee-1', menteeName: 'A' }]);
    getMenteePairing.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    upsert.mockResolvedValueOnce({ id: 'convo-1' });

    const { ensureDirectConversations } = await import('@/features/messages/data');
    await expect(ensureDirectConversations('mentor-1')).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledWith({
      where: { directKey: 'c1:mentee-1:mentor-1' },
      update: {},
      create: {
        directKey: 'c1:mentee-1:mentor-1',
        cohortId: 'c1',
        type: 'DIRECT',
        participants: { create: [{ userId: 'mentor-1' }, { userId: 'mentee-1' }] },
      },
    });
  });

  it('rethrows infrastructure failures from the atomic upsert', async () => {
    getMentorPairings.mockResolvedValue([{ cohortId: 'c1', menteeId: 'mentee-1', menteeName: 'A' }]);
    getMenteePairing.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    upsert.mockRejectedValueOnce(new Error('connection reset'));

    const { ensureDirectConversations } = await import('@/features/messages/data');
    await expect(ensureDirectConversations('mentor-1')).rejects.toThrow('connection reset');
  });

  it('generates order-independent direct keys and opaque realtime topics', async () => {
    process.env.REALTIME_CHANNEL_SECRET = 'test-realtime-secret';
    const { directConversationKey, realtimeChannelName } = await import('@/features/messages/data');

    expect(directConversationKey('c1', 'mentor-1', 'mentee-1')).toBe(
      directConversationKey('c1', 'mentee-1', 'mentor-1'),
    );
    const topic = realtimeChannelName('conversation-public-id');
    expect(topic).toMatch(/^conversation:[A-Za-z0-9_-]{43}$/);
    expect(topic).not.toContain('conversation-public-id');
    delete process.env.REALTIME_CHANNEL_SECRET;
  });
});
