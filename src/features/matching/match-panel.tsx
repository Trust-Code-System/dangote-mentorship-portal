import { getTranslations } from 'next-intl/server';
import { MatchStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { RespondMatchButtons } from './match-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Match panel on the mentor/mentee dashboards: shows pairs awaiting the
// user's response (admin-approved or overridden) and active accepted pairs.
export async function MatchPanel({ userId, role, hideAccepted = false }: { userId: string; role: 'mentor' | 'mentee'; hideAccepted?: boolean }) {
  const t = await getTranslations('matching');

  const where = role === 'mentor' ? { mentorId: userId } : { menteeId: userId };
  const matches = await prisma.match.findMany({
    where: {
      ...where,
      deletedAt: null,
      status: { in: [MatchStatus.ADMIN_APPROVED, MatchStatus.OVERRIDDEN, MatchStatus.ACCEPTED] },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      mentor: { select: { name: true, email: true } },
      mentee: { select: { name: true, email: true } },
    },
  });

  const pending = matches.filter((m) => m.status !== MatchStatus.ACCEPTED);
  const accepted = hideAccepted ? [] : matches.filter((m) => m.status === MatchStatus.ACCEPTED);
  if (hideAccepted && pending.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('myMatchTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noMatchYet')}</p>
        ) : null}

        {pending.map((m) => {
          const other = role === 'mentor' ? m.mentee : m.mentor;
          return (
            <div key={m.id} className="space-y-2 rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{other.name}</p>
                <Badge variant="outline">{t('pendingYourResponse')}</Badge>
              </div>
              {m.aiRationale ? (
                <p className="text-sm text-muted-foreground">{m.aiRationale}</p>
              ) : null}
              <RespondMatchButtons
                matchId={m.id}
                otherName={other.name ?? ''}
                labels={{
                  accept: t('acceptMatch'),
                  accepting: t('accepting'),
                  decline: t('rejectMatch'),
                  declining: t('declining'),
                  acceptedTitle: t('respondAcceptedTitle'),
                  acceptedDone: t('respondAcceptedDone'),
                  declinedTitle: t('respondDeclinedTitle'),
                  declinedDone: t('respondDeclinedDone'),
                  errorTitle: t('respondErrorTitle'),
                }}
              />
            </div>
          );
        })}

        {accepted.map((m) => {
          const other = role === 'mentor' ? m.mentee : m.mentor;
          return (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
              <div>
                <p className="font-medium">{other.name}</p>
                <p className="text-sm text-muted-foreground">{other.email}</p>
              </div>
              <Badge>{t('matchedWith')}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
