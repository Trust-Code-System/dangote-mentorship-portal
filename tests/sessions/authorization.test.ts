import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  actor: { id: 'cmwmentee00000000000000001', name: 'Mentee', roles: ['MENTEE'] as string[] },
  role: vi.fn(),
  user: vi.fn(),
  pairing: vi.fn(),
  accepted: vi.fn(),
  access: vi.fn(),
  findLog: vi.fn(),
  createLog: vi.fn(),
  updateLog: vi.fn(),
  createItem: vi.fn(),
  findItem: vi.fn(),
  updateItem: vi.fn(),
  audit: vi.fn(),
  notify: vi.fn(),
  summary: vi.fn(),
  goals: vi.fn(),
  Denied: class extends Error {},
  Unauthenticated: class extends Error {},
}));
vi.mock('@/lib/auth/rbac', () => ({
  requireRole: m.role,
  requireUser: m.user,
  ForbiddenError: m.Denied,
  UnauthenticatedError: m.Unauthenticated,
}));
vi.mock('@/lib/pairings', () => ({ getMenteePairing: m.pairing, isAcceptedPair: m.accepted }));
vi.mock('@/features/assessments/guard', () => ({ requirePortalAccess: m.access }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));
vi.mock('@/lib/audit/audit', () => ({ writeAuditLog: m.audit }));
vi.mock('@/lib/notifications/notify', () => ({ notify: m.notify }));
vi.mock('@/lib/auth/rate-limit-shared', () => ({ checkRateLimit: async () => ({ ok: true }) }));
vi.mock('@/features/sessions/data', () => ({ getPairGoalTitles: m.goals }));
vi.mock('@/features/sessions/summary', () => ({ summarizeSession: m.summary }));
vi.mock('@/lib/db/prisma', () => {
  const tx = {
    sessionLog: { findUnique: m.findLog, create: m.createLog, update: m.updateLog },
    actionItem: { create: m.createItem, findUnique: m.findItem, update: m.updateItem },
    user: { findUnique: async () => ({ name: 'Mentee' }) },
  };
  return { prisma: { ...tx, $transaction: (fn: (db: typeof tx) => unknown) => fn(tx) } };
});
import {
  saveSessionLog,
  saveReflection,
  addActionItem,
  updateActionItemStatus,
  requestSessionAssistant,
} from '@/features/sessions/actions';

const mentee = 'cmwmentee00000000000000001';
const mentor = 'cmwmentor00000000000000001';
const logId = 'cmwsession0000000000000001';
const cohortId = 'cohort';
const log = {
  id: logId,
  menteeId: mentee,
  mentorId: mentor,
  cohortId,
  recordedById: mentee,
  deletedAt: null,
  mentorNotes: 'Original private notes',
  menteeReflection: 'Original mentee reflection',
};
const form = (extra: Record<string, string> = {}) => {
  const fd = new FormData();
  for (const key of [
    'date',
    'time',
    'competencyDiscussed',
    'goalDiscussed',
    'discussionSummary',
    'actionsAgreed',
    'challenges',
    'resourcesNeeded',
    'nextActionPlan',
    'timeline',
    'nextMeetingDate',
    'aiSummary',
  ])
    fd.set(key, '');
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
};
function asMentor() {
  m.actor.id = mentor;
  m.actor.roles = ['MENTOR'];
}
beforeEach(() => {
  vi.clearAllMocks();
  m.actor.id = mentee;
  m.actor.roles = ['MENTEE'];
  m.role.mockImplementation(async (role: string) => {
    if (!m.actor.roles.includes(role)) throw new m.Denied('Forbidden');
    return m.actor;
  });
  m.user.mockImplementation(async () => m.actor);
  m.access.mockResolvedValue(undefined);
  m.pairing.mockResolvedValue({ cohortId, mentorId: mentor, mentorName: 'Mentor' });
  m.accepted.mockResolvedValue(true);
  m.findLog.mockResolvedValue({ ...log });
  m.createLog.mockResolvedValue({ ...log });
  m.updateLog.mockResolvedValue({ ...log });
  m.createItem.mockResolvedValue({ id: logId });
  m.updateItem.mockResolvedValue({ id: logId });
  m.goals.mockResolvedValue([]);
  m.summary.mockResolvedValue({ aiEnabled: false, result: null });
});
it('only the mentee can create logs, request AI or add session actions', async () => {
  asMentor();
  expect((await saveSessionLog(form())).ok).toBe(false);
  expect((await requestSessionAssistant({ notes: 'Meeting notes' })).ok).toBe(false);
  expect(
    (await addActionItem(form({ sessionLogId: logId, title: 'Task', assignee: 'mentee' }))).ok,
  ).toBe(false);
  expect(m.createLog).not.toHaveBeenCalled();
  expect(m.summary).not.toHaveBeenCalled();
  expect(m.createItem).not.toHaveBeenCalled();
});
it('derives participants from the session and accepted pair, never forged form IDs or private fields', async () => {
  const r = await saveSessionLog(
    form({
      menteeId: mentor,
      mentorId: mentee,
      mentorNotes: 'Forged',
      menteeReflection: 'Forged',
      mentorReflection: 'Forged',
      actionItems: JSON.stringify([
        { task: 'Mentor task', assignee: 'mentor' },
        { task: 'Mentee task', assignee: 'mentee' },
      ]),
    }),
  );
  expect(r.ok).toBe(true);
  const fields = m.createLog.mock.calls[0]![0].data;
  expect(fields).toMatchObject({
    mentorId: mentor,
    menteeId: mentee,
    recordedById: mentee,
    cohortId,
  });
  expect(fields).not.toHaveProperty('mentorNotes');
  expect(fields).not.toHaveProperty('menteeReflection');
  expect(fields).not.toHaveProperty('mentorReflection');
  expect(m.createItem.mock.calls.map((c) => c[0].data.assigneeId)).toEqual([mentor, mentee]);
  expect(m.notify).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: mentor,
      type: 'session_recorded',
      params: { menteeName: 'Mentee' },
    }),
  );
});
it('denies creation and AI when there is no accepted pairing', async () => {
  m.pairing.mockResolvedValue(null);
  expect((await saveSessionLog(form())).ok).toBe(false);
  expect((await requestSessionAssistant({ notes: 'Notes' })).ok).toBe(false);
  expect(m.createLog).not.toHaveBeenCalled();
  expect(m.summary).not.toHaveBeenCalled();
});
it('does not let a mentee edit a legacy mentor-authored log or add actions to it', async () => {
  m.findLog.mockResolvedValue({ ...log, recordedById: null });
  expect((await saveSessionLog(form({ logId }))).ok).toBe(false);
  expect(
    (await addActionItem(form({ sessionLogId: logId, title: 'Task', assignee: 'mentee' }))).ok,
  ).toBe(false);
  expect(m.updateLog).not.toHaveBeenCalled();
  expect(m.createItem).not.toHaveBeenCalled();
});
it('updates only shared fields on the mentee recorder’s log', async () => {
  expect(
    (
      await saveSessionLog(
        form({ logId, discussionSummary: 'Updated summary', mentorNotes: 'Overwrite' }),
      )
    ).ok,
  ).toBe(true);
  const fields = m.updateLog.mock.calls[0]![0].data;
  expect(fields.discussionSummary).toBe('Updated summary');
  expect(fields).not.toHaveProperty('mentorNotes');
  expect(fields).not.toHaveProperty('mentorReflection');
});
it('only the paired mentor saves reflection, without rewriting the historical mentee reflection', async () => {
  expect((await saveReflection(form({ logId, reflection: 'Not allowed' }))).ok).toBe(false);
  asMentor();
  expect((await saveReflection(form({ logId, reflection: 'Mentor feedback' }))).ok).toBe(true);
  expect(m.updateLog).toHaveBeenCalledWith({
    where: { id: logId },
    data: { mentorReflection: 'Mentor feedback' },
  });
});
it('rejects another mentor and closed or cross-cohort pairings', async () => {
  asMentor();
  m.actor.id = 'cmwother000000000000000001';
  expect((await saveReflection(form({ logId, reflection: 'Wrong person' }))).ok).toBe(false);
  asMentor();
  m.accepted.mockResolvedValue(false);
  expect((await saveReflection(form({ logId, reflection: 'Closed pair' }))).ok).toBe(false);
  m.actor.id = mentee;
  m.actor.roles = ['MENTEE'];
  expect((await saveSessionLog(form({ logId }))).ok).toBe(false);
  expect(m.updateLog).not.toHaveBeenCalled();
});
it('allows assignees and the mentee recorder to update action items, not a mentor override', async () => {
  m.findItem.mockResolvedValue({
    id: logId,
    assigneeId: mentee,
    deletedAt: null,
    cohortId,
    sessionLog: { ...log },
  });
  asMentor();
  expect((await updateActionItemStatus(form({ itemId: logId, status: 'DONE' }))).ok).toBe(false);
  m.findItem.mockResolvedValue({
    id: logId,
    assigneeId: mentor,
    deletedAt: null,
    cohortId,
    sessionLog: { ...log },
  });
  expect((await updateActionItemStatus(form({ itemId: logId, status: 'DONE' }))).ok).toBe(true);
  m.actor.id = mentee;
  m.actor.roles = ['MENTEE'];
  expect((await updateActionItemStatus(form({ itemId: logId, status: 'DONE' }))).ok).toBe(true);
});
