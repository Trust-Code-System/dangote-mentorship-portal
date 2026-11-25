import { beforeEach, expect, it, vi } from 'vitest';
import { ReviewType } from '@prisma/client';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { featureFlag: { findFirst: m.find } } }));
import { quarterlyAssessmentsEnabled, recurringFormEnabled } from '@/features/assessments/policy';

beforeEach(() => {
  vi.clearAllMocks();
  m.find.mockResolvedValue(null);
});
it('preserves existing cohorts and never reads a global flag', async () => {
  expect(await quarterlyAssessmentsEnabled('old-cohort')).toBe(true);
  expect(m.find).toHaveBeenCalledWith({
    where: { key: 'quarterly_assessments_disabled', cohortId: 'old-cohort', deletedAt: null },
    select: { enabled: true },
  });
});
it('only removes quarterly forms when the stream opts out', async () => {
  m.find.mockResolvedValue({ enabled: true });
  expect(await recurringFormEnabled('new-cohort', ReviewType.QUARTERLY)).toBe(false);
  expect(await recurringFormEnabled('new-cohort', ReviewType.MONTHLY)).toBe(true);
  expect(await recurringFormEnabled('new-cohort', ReviewType.MIDTERM)).toBe(true);
  expect(await recurringFormEnabled('new-cohort', ReviewType.FINAL)).toBe(true);
});
it('a disabled opt-out flag leaves quarterly forms enabled', async () => {
  m.find.mockResolvedValue({ enabled: false });
  expect(await quarterlyAssessmentsEnabled('old-cohort')).toBe(true);
});
