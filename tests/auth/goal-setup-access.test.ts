import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleName } from '@prisma/client';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), gate: vi.fn(), headers: vi.fn() }));
vi.mock('@/lib/auth/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { user: { findFirst: mocks.user } } }));
vi.mock('@/features/goals/onboarding', () => ({ getGoalSetupGate: mocks.gate }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
const { requireUser, ForbiddenError } = await import('@/lib/auth/rbac');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.user.mockResolvedValue({
    id: 'user-1',
    email: 'mentee@example.com',
    name: 'Mentee',
    locale: 'EN',
    image: null,
    userRoles: [{ cohortId: 'cohort-1', role: { name: RoleName.MENTEE } }],
  });
  mocks.gate.mockResolvedValue({ locked: true, cohortId: 'cohort-1' });
  mocks.headers.mockResolvedValue(
    new Headers({ 'next-action': 'action-id', 'x-pathname': '/goals' }),
  );
});
describe('goal setup access enforcement', () => {
  it('rejects unrelated server actions even if replayed from the allowed goal page', async () => {
    await expect(requireUser()).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('allows the explicit goal setup action exemption', async () => {
    expect((await requireUser({ allowGoalSetup: true })).id).toBe('user-1');
  });
  it('redirects page-level auth checks to goals instead of showing an error', async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-pathname': '/dashboard/mentee' }));
    await expect(requireUser()).rejects.toThrow('REDIRECT:/goals');
  });
  it('allows ordinary actions immediately after the first saved goal', async () => {
    mocks.gate.mockResolvedValue({ locked: false, cohortId: 'cohort-1' });
    expect((await requireUser()).id).toBe('user-1');
  });
  it('still requires authentication for goal setup', async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireUser({ allowGoalSetup: true })).rejects.toThrow('You must be signed in');
  });
});
