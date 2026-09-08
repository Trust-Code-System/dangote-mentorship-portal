import { getTranslations } from 'next-intl/server';
import { requirePageUser } from '@/lib/auth/page-user';
import { getPairWorkspace } from '@/features/pair/data';
import { PairWorkspaceView } from '@/features/pair/workspace-view';

export default async function PairPage({ params }: { params: Promise<{ menteeId: string }> }) {
  const { menteeId } = await params;
  const user = await requirePageUser();
  const t = await getTranslations('pair');
  const pair = await getPairWorkspace(user.id, menteeId);

  // Missing / unauthorized pair → empty state (not a global crash / hard 404).
  if (!pair) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-h1 text-ink">{t('title')}</h1>
        <p className="text-ink-2">{t('noPair')}</p>
      </div>
    );
  }

  return <PairWorkspaceView pair={pair} />;
}
