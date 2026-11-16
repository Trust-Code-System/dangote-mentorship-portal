import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ user: vi.fn(), data: vi.fn(), pdf: vi.fn(), scope: vi.fn() }));
vi.mock('@/lib/auth/rbac', () => ({
  getCurrentUser: m.user,
  canAccessCohort: m.scope,
  hasAnyRole: (u: { roles: string[] }) => u.roles.includes('SUPER_ADMIN'),
}));
vi.mock('@/features/certificate/data', () => ({ getCertificateForViewer: m.data }));
vi.mock('@/features/certificate/pdf', () => ({ renderCertificatePdf: m.pdf }));
import { GET } from '@/app/api/certificates/[matchId]/pdf/route';
const get = (query: string) =>
  GET(new Request(`https://portal.test/api/certificates/match/pdf?role=mentee&${query}`), {
    params: Promise.resolve({ matchId: 'match' }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.scope.mockReturnValue(true);
  m.user.mockResolvedValue({ id: 'mentee', roles: ['MENTEE'] });
  m.data.mockResolvedValue({ role: 'mentee', earned: false, recipientName: 'Mentee' });
  m.pdf.mockResolvedValue(Buffer.from('%PDF'));
});
it.each(['', 'preview=1', 'download=1', 'preview=1&download=1&lang=FR'])(
  'rejects an unapproved direct request with %s',
  async (query) => {
    expect((await get(query)).status).toBe(403);
    expect(m.pdf).not.toHaveBeenCalled();
  },
);
it('rejects unauthenticated and unrelated viewers before rendering', async () => {
  m.user.mockResolvedValue(null);
  expect((await get('')).status).toBe(401);
  m.user.mockResolvedValue({ id: 'other', roles: ['MENTEE'] });
  m.data.mockResolvedValue(null);
  expect((await get('preview=1')).status).toBe(404);
  expect(m.pdf).not.toHaveBeenCalled();
});
it('allows an approved completed certificate and forbids caching', async () => {
  m.data.mockResolvedValue({ role: 'mentee', earned: true, recipientName: 'Mentee' });
  const r = await get('download=1');
  expect(r.status).toBe(200);
  expect(r.headers.get('cache-control')).toContain('no-store');
});
it('allows only a marked admin preview before release', async () => {
  m.user.mockResolvedValue({ id: 'admin', roles: ['SUPER_ADMIN'] });
  expect((await get('')).status).toBe(409);
  expect((await get('preview=1')).status).toBe(200);
  expect(m.pdf).toHaveBeenCalledWith(expect.objectContaining({ earned: false }), 'EN');
});
it('does not grant a dual-role certificate owner an out-of-cohort admin preview bypass', async () => {
  m.user.mockResolvedValue({ id: 'mentee', roles: ['MENTEE', 'SUPER_ADMIN'] });
  m.scope.mockReturnValue(false);
  expect((await get('preview=1')).status).toBe(403);
  expect(m.pdf).not.toHaveBeenCalled();
});
