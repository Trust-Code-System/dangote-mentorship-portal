import Link from 'next/link';
import { RoleName } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import { requirePageUser } from '@/lib/auth/page-user';
import { getPairWorkspace, getViewablePairs } from '@/features/pair/data';
import { PairWorkspaceView } from '@/features/pair/workspace-view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Entry point for the Pair Contract Page (§1.8). A mentee with a single pair
// renders the workspace in-place (no server redirect) to avoid prefetch+redirect
// races during sidebar client navigation. Mentors pick a mentee when they have
// more than one pairing.
export default async function PairIndexPage() {
  const user = await requirePageUser();
  const t = await getTranslations('pair');

  const isMentor = user.roles.includes(RoleName.MENTOR);
  const isMentee = user.roles.includes(RoleName.MENTEE);

  if (!isMentor && !isMentee) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-h1 text-ink">{t('title')}</h1>
        <p className="text-ink-2">{t('noAccess')}</p>
      </div>
    );
  }

  const pairs = await getViewablePairs(user.id, { isMentor, isMentee });

  if (pairs.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-h1 text-ink">{t('title')}</h1>
        <p className="text-ink-2">{t('noPair')}</p>
      </div>
    );
  }

  // Mentee (single pair): render workspace here — do not redirect.
  const only = pairs[0];
  if (pairs.length === 1 && !isMentor && only) {
    const workspace = await getPairWorkspace(user.id, only.menteeId);
    if (!workspace) {
      return (
        <div className="space-y-4">
          <h1 className="font-display text-h1 text-ink">{t('title')}</h1>
          <p className="text-ink-2">{t('noPair')}</p>
        </div>
      );
    }
    return <PairWorkspaceView pair={workspace} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-h1 text-ink">{t('title')}</h1>
        <p className="text-ink-2">{t('pickMentee')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {pairs.map((p) => (
          <Link key={p.menteeId} href={`/pair/${p.menteeId}`} className="block">
            <Card className="transition-colors hover:bg-surface-2">
              <CardHeader>
                <CardTitle className="text-h3">{p.menteeName ?? '—'}</CardTitle>
              </CardHeader>
              <CardContent className="text-small text-ink-2">{t('openWorkspace')}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
