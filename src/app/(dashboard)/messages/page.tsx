import { requirePageUser } from '@/lib/auth/page-user';
import { MessagesWorkspace } from '@/features/messages/messages-workspace';

// Direct messages (CLAUDE.md §10). DMs are auto-provisioned for accepted pairs
// on load. Renders the workspace in-place (no server redirect) so sidebar
// client navigations cannot race a prefetched redirect Flight payload.
export default async function MessagesPage() {
  const user = await requirePageUser();
  return <MessagesWorkspace userId={user.id} conversationId={null} />;
}
