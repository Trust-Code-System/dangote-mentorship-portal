import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  user: vi.fn(),
  participant: vi.fn(),
  form: vi.fn(),
  existing: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  cycle: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/rbac', () => ({ requireUser: m.user, requireRole: vi.fn() }));
vi.mock('@/features/reviews/data', () => ({
  resolveReviewParticipant: m.participant,
  ensureReviewCycle: m.cycle,
}));
vi.mock('@/features/forms/data', () => ({ getFormDefinition: m.form }));
vi.mock('@/lib/db/prisma', () => ({
  prisma: { formResponse: { findFirst: m.existing, create: m.create, update: m.update } },
}));
vi.mock('@/lib/audit/audit', () => ({ writeAuditLog: m.audit }));
vi.mock('@/lib/ai', () => ({ getAiAdapter: vi.fn() }));
vi.mock('@/lib/auth/rate-limit-shared', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/features/reviews/rollup', () => ({
  getReviewRollup: vi.fn(),
  resolveReviewerCohortId: vi.fn(),
}));
import { submitReviewResponse } from '@/features/reviews/actions';
const mentee = 'cmentee1234567890123456789';
function input(subject = mentee) {
  const f = new FormData();
  f.set('formId', 'cform12345678901234567890');
  f.set('type', 'MIDTERM');
  f.set('subjectMenteeId', subject);
  f.set('answers', '{}');
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ id: 'mentor', roles: ['MENTOR'] });
  m.participant.mockResolvedValue({
    cohortId: 'cohort',
    roleName: 'MENTOR',
    subjectMenteeId: mentee,
  });
  m.form.mockResolvedValue({
    id: 'cform12345678901234567890',
    cohortId: 'cohort',
    roleName: 'MENTOR',
    type: 'MIDTERM',
    isActive: true,
    schema: {
      fields: [
        {
          id: 'note',
          labelEn: 'Note',
          labelFr: '',
          type: 'long_text',
          required: false,
          sourceQuestion: '1',
        },
      ],
    },
  });
  m.existing.mockResolvedValue(null);
  m.cycle.mockResolvedValue('cycle');
  m.create.mockResolvedValue({ id: 'response' });
});
it('rejects a role-specific mentee form posted by a mentor before reading or writing responses', async () => {
  const form = await m.form();
  m.form.mockResolvedValue({ ...form, roleName: 'MENTEE' });
  expect(await submitReviewResponse(input())).toMatchObject({
    ok: false,
    error: { code: 'NOT_FOUND' },
  });
  expect(m.existing).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it('rejects a form in another cohort', async () => {
  const form = await m.form();
  m.form.mockResolvedValue({ ...form, cohortId: 'other' });
  expect(await submitReviewResponse(input())).toMatchObject({ ok: false });
  expect(m.create).not.toHaveBeenCalled();
});
it('partitions mentor submissions by the authorized mentee so another review is not overwritten', async () => {
  expect(await submitReviewResponse(input())).toMatchObject({ ok: true });
  expect(m.existing).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ respondentId: 'mentor', subjectMenteeId: mentee }),
    }),
  );
  expect(m.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ respondentId: 'mentor', subjectMenteeId: mentee }),
    }),
  );
  expect(m.update).not.toHaveBeenCalled();
});
