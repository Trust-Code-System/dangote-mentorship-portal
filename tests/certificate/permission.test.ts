import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  match: vi.fn(),
  profile: vi.fn(),
  goal: vi.fn(),
  response: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    match: { findFirst: m.match },
    menteeProfile: { findFirst: m.profile },
    mentorProfile: { findFirst: m.profile },
    goal: { findFirst: m.goal },
    formResponse: { findFirst: m.response },
  },
}));
vi.mock('@/lib/auth/rbac', () => ({
  hasAnyRole: (u: { roles: string[] }) => u.roles.includes('SUPER_ADMIN'),
  canAccessCohort: () => false,
  adminCohortFilter: () => ({}),
}));
import { getCertificateData } from '@/features/certificate/data';

const match = {
  id: 'match',
  cohortId: 'cohort',
  mentorId: 'mentor',
  menteeId: 'mentee',
  mentor: { id: 'mentor', name: 'Mentor', locale: 'EN' },
  mentee: { id: 'mentee', name: 'Mentee', locale: 'EN' },
  cohort: { name: 'Stream', endDate: null, programme: { name: 'Programme' } },
  menteeCertificateApprovedAt: null as Date | null,
  menteeCertificateApprovedById: null as string | null,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.match.mockImplementation(() => Promise.resolve({ ...match }));
  m.profile.mockResolvedValue({ trainingStatus: 'COMPLETED' });
  m.goal.mockResolvedValue({ updatedAt: new Date('2026-11-15') });
  m.response.mockResolvedValue({ submittedAt: new Date('2026-11-15') });
});
it('keeps a fully completed mentee locked without explicit admin approval', async () => {
  const data = await getCertificateData('mentee');
  expect(data?.requirementsMet).toBe(true);
  expect(data?.adminApproved).toBe(false);
  expect(data?.earned).toBe(false);
});
it.each([
  [new Date('2026-11-16'), null],
  [null, 'admin'],
])('fails closed on incomplete approval records', async (at, by) => {
  m.match.mockResolvedValue({
    ...match,
    menteeCertificateApprovedAt: at,
    menteeCertificateApprovedById: by,
  });
  expect((await getCertificateData('mentee'))?.earned).toBe(false);
});
it('unlocks only when approval and completion are both recorded', async () => {
  m.match.mockResolvedValue({
    ...match,
    menteeCertificateApprovedAt: new Date('2026-11-16'),
    menteeCertificateApprovedById: 'admin',
  });
  expect((await getCertificateData('mentee'))?.earned).toBe(true);
  m.profile.mockResolvedValue({ trainingStatus: 'IN_PROGRESS' });
  expect((await getCertificateData('mentee'))?.earned).toBe(false);
});
it('does not add a mentee-only approval rule to mentor certificates', async () => {
  expect((await getCertificateData('mentor'))?.earned).toBe(true);
});
