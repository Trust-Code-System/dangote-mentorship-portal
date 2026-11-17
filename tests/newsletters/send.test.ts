import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendNewsletter } from '@/features/newsletters/send';
import { emptyNewsletterBody } from '@/features/newsletters/schema';

const mocks = vi.hoisted(() => ({
  issue: vi.fn(),
  finish: vi.fn(),
  materialize: vi.fn(),
  rows: vi.fn(),
  delivered: vi.fn(),
  recipients: vi.fn(),
  mail: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    newsletter: { findFirst: mocks.issue, update: mocks.finish },
    newsletterRecipient: {
      createMany: mocks.materialize,
      findMany: mocks.rows,
      update: mocks.delivered,
    },
  },
}));
vi.mock('@/features/newsletters/data', () => ({ listCohortRecipients: mocks.recipients }));
vi.mock('@/lib/mail', () => ({ sendEmail: mocks.mail }));
vi.mock('@/lib/observability/report', () => ({ reportError: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  const body = emptyNewsletterBody();
  body.sections[0]!.bodyEn = 'This week, review your mentorship goals.';
  mocks.issue.mockResolvedValue({
    id: 'issue',
    cohortId: 'cohort',
    title: 'Programme update',
    subjectEn: 'This week',
    status: 'SCHEDULED',
    approvedAt: new Date(),
    bodyJson: body,
    cohort: { name: 'Current stream' },
  });
  mocks.recipients.mockResolvedValue([
    { userId: 'a', email: 'a@example.test', locale: 'EN' },
    { userId: 'b', email: 'b@example.test', locale: 'EN' },
  ]);
  mocks.rows.mockResolvedValue([
    { id: 'row-a', userId: 'a', sentAt: null },
    { id: 'row-b', userId: 'b', sentAt: null },
  ]);
});

describe('newsletter delivery recovery', () => {
  it('keeps partial delivery retryable and sends only the failed recipient on retry', async () => {
    mocks.mail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('SMTP unavailable'));
    expect(await sendNewsletter('issue')).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.delivered).toHaveBeenCalledTimes(1);
    mocks.rows.mockResolvedValue([
      { id: 'row-a', userId: 'a', sentAt: new Date() },
      { id: 'row-b', userId: 'b', sentAt: null },
    ]);
    mocks.mail.mockClear().mockResolvedValue(undefined);
    expect(await sendNewsletter('issue')).toEqual({ sent: 1, failed: 0, skipped: 1 });
    expect(mocks.mail).toHaveBeenCalledTimes(1);
    expect(mocks.mail).toHaveBeenCalledWith(expect.objectContaining({ to: 'b@example.test' }));
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'SENT', sentAt: expect.any(Date) },
      }),
    );
  });

  it('repairs a missing issue completion stamp without resending delivered emails', async () => {
    mocks.rows.mockResolvedValue([
      { id: 'row-a', userId: 'a', sentAt: new Date() },
      { id: 'row-b', userId: 'b', sentAt: new Date() },
    ]);
    expect(await sendNewsletter('issue')).toEqual({ sent: 0, failed: 0, skipped: 2 });
    expect(mocks.mail).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledOnce();
  });

  it('does not report an empty audience as delivered', async () => {
    mocks.recipients.mockResolvedValue([]);
    mocks.rows.mockResolvedValue([]);
    expect(await sendNewsletter('issue')).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(mocks.mail).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });
});
