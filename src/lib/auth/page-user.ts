import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser, type SessionUser } from '@/lib/auth/rbac';

/**
 * Page-level auth: redirect to login instead of throwing UnauthenticatedError.
 * Thrown auth errors during RSC soft-navigation surface as Next's global
 * "This page couldn’t load" screen; redirects do not.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
