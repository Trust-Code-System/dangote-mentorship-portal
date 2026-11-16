import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ logs: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { sessionLog: { findMany: m.logs } } }));
vi.mock('@/lib/pairings', () => ({ getMenteePairing: vi.fn(), getMentorPairings: vi.fn() }));
import { getMenteeSessionLogs } from '@/features/sessions/data';
it('excludes original private mentor notes while preserving shared and historical reflection fields', async () => {
  m.logs.mockResolvedValue([
    {
      id: 'log',
      mentorNotes: 'Private scratchpad',
      menteeReflection: 'Original mentee words',
      mentorReflection: 'New mentor words',
    },
  ]);
  const rows = await getMenteeSessionLogs('mentee');
  expect(rows[0]).toMatchObject({
    mentorNotes: null,
    menteeReflection: 'Original mentee words',
    mentorReflection: 'New mentor words',
  });
});
