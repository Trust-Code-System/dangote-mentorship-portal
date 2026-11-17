import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  flags: vi.fn(),
  forms: vi.fn(),
  responses: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    featureFlag: { findMany: mocks.flags },
    formDefinition: { findMany: mocks.forms },
    formResponse: { findMany: mocks.responses },
  },
}));
vi.mock('@/lib/audit/audit', () => ({ writeAuditLog: mocks.audit }));
import { getConfidentialReviewResponses } from '@/features/reviews/confidential';
beforeEach(() => vi.clearAllMocks());
it('fails closed without a named grant and never queries response bodies', async () => {
  mocks.flags.mockResolvedValue([]);
  expect(await getConfidentialReviewResponses('administrator')).toBeNull();
  expect(mocks.responses).not.toHaveBeenCalled();
  expect(mocks.flags).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        key: 'review_concerns_reader:administrator',
        enabled: true,
      }),
    }),
  );
});
it('scopes a named coordinator to granted cohorts and returns only confidential fields', async () => {
  mocks.flags.mockResolvedValue([{ cohortId: 'allowed-cohort' }]);
  mocks.forms.mockResolvedValue([
    {
      id: 'form',
      title: 'Review',
      cohortId: 'allowed-cohort',
      cohort: { name: 'Stream' },
      schema: {
        fields: [
          {
            id: 'private',
            type: 'long_text',
            labelEn: 'Private concern',
            required: false,
            confidential: true,
          },
          { id: 'public', type: 'long_text', labelEn: 'General feedback', required: false },
        ],
      },
    },
  ]);
  mocks.responses.mockResolvedValue([
    {
      id: 'response',
      formId: 'form',
      answers: { private: 'Please contact me', public: 'Unrelated feedback' },
      submittedAt: new Date(),
      respondent: { name: 'Test', email: 'test@example.invalid' },
    },
  ]);
  const result = await getConfidentialReviewResponses('coordinator');
  expect(mocks.forms).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ cohortId: { in: ['allowed-cohort'] } }),
    }),
  );
  expect(result?.[0]?.answers).toEqual([{ label: 'Private concern', value: 'Please contact me' }]);
  expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('Please contact me');
});
