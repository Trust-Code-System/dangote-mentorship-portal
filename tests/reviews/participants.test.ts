import { it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/pairings', () => ({
  getMenteePairing: vi.fn(),
  getMentorPairings: vi.fn(async () => [
    { cohortId: 'cohort-a', menteeId: 'mentee-a' },
    { cohortId: 'cohort-b', menteeId: 'mentee-b' },
  ]),
}));
import { resolveReviewParticipant } from '@/features/reviews/data';
import type { SessionUser } from '@/lib/auth/rbac';
const mentor = { id: 'mentor', roles: ['MENTOR'] } as SessionUser;
it('resolves each accepted mentee and their own cohort instead of reusing the first mentee', async () => {
  expect(await resolveReviewParticipant(mentor, 'mentee-b')).toMatchObject({
    cohortId: 'cohort-b',
    subjectMenteeId: 'mentee-b',
  });
  expect(await resolveReviewParticipant(mentor, 'mentee-a')).toMatchObject({
    cohortId: 'cohort-a',
    subjectMenteeId: 'mentee-a',
  });
});
it('rejects a mentee outside the mentor’s accepted pairings', async () => {
  expect(await resolveReviewParticipant(mentor, 'someone-else')).toBeNull();
});
