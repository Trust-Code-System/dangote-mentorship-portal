import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/rbac';
import { defaultDashboardPath } from '@/lib/auth/roles';

// The root of the portal is the front door, not a brochure.
//
// This is an invite-only, `noindex` internal programme: nobody can sign
// themselves up, so a visitor at `/` is almost always a participant who wants
// to sign in. They get the sign-in screen directly. The nine-section marketing
// narrative still exists — it moved to `/welcome`, and the sign-in footer links
// to it.
//
// A signed-in visitor skips `/login` entirely and lands on their own dashboard,
// so the common case is one redirect rather than two.
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? defaultDashboardPath(user.roles) : '/login');
}
