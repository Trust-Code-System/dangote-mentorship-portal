import { requirePageUser } from '@/lib/auth/page-user';
import { MessagesWorkspace } from '@/features/messages/messages-workspace';

// A single conversation thread. getThread also authorizes participation
// (returns null for non-participants → empty selection), so admins/non-members
// cannot read content.
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const user = await requirePageUser();
  return <MessagesWorkspace userId={user.id} conversationId={conversationId} />;
}
