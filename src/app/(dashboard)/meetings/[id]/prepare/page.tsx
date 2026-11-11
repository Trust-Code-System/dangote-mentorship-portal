import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import { getAiAdapter } from '@/lib/ai';
import { getMeetingPrep } from '@/features/meetings/prepare-data';
import { fallbackPrep, type MeetingPrepResult } from '@/features/meetings/prepare';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IcebreakerCard } from '@/app/(dashboard)/pair/[menteeId]/icebreaker-card';
import { GenerateButton } from './generate-button';

// AI meeting preparation view (experience-layer.md §1.5). Both participants can
// open it. The real context (previous summary, pending action items, goals) shows
// always; the AI suggestion is generated on demand and cached per meeting,
// degrading to the static Mentor-Guide prep when AI is off.
export default async function PreparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations('prepare');

  const view = await getMeetingPrep(id, user.id);
  if (!view) notFound();

  const lang = user.locale === 'FR' ? 'FR' : 'EN';
  const aiEnabled = getAiAdapter().enabled;
  const prep: MeetingPrepResult = view.cached ?? fallbackPrep(view.context, lang);
  const usingFallback = view.cached === null;

  const { context } = view;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/meetings" className="text-sm text-muted-foreground hover:underline">
          ← {t('backToMeetings')}
        </Link>
        <h1 className="mt-1 font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-muted-foreground">
          {context.meetingTitle}
          {view.meeting.startsAt ? ` · ${view.meeting.startsAt.toISOString().slice(0, 16).replace('T', ' ')}` : ''}
          {context.counterpartName ? ` · ${context.counterpartName}` : ''}
        </p>
      </div>

      {/* First meeting (no prior session logged) — show the icebreaker (§1.17) */}
      {context.previousSessionSummary === null ? (
        <IcebreakerCard viewerId={user.id} menteeId={view.meeting.menteeId} />
      ) : null}

      {/* Real context — always shown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('previousSession')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {context.previousSessionSummary ? (
              <>
                {context.previousSessionDate ? (
                  <p className="mb-1 text-xs text-muted-foreground">{context.previousSessionDate}</p>
                ) : null}
                <p className="whitespace-pre-wrap">{context.previousSessionSummary}</p>
              </>
            ) : (
              <p className="text-muted-foreground">{t('noPreviousSession')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('pendingActions')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {context.pendingActionItems.length === 0 ? (
              <p className="text-muted-foreground">{t('noPendingActions')}</p>
            ) : (
              <ul className="space-y-1">
                {context.pendingActionItems.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <span>{a.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.owner ?? ''}
                      {a.due ? ` · ${a.due}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('goalsToReview')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {context.goalTitles.length === 0 ? (
              <p className="text-muted-foreground">{t('noGoals')}</p>
            ) : (
              <ul className="ml-4 list-disc">
                {context.goalTitles.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI suggestion — generated on demand, cached */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{t('suggestions')}</CardTitle>
            <div className="flex items-center gap-2">
              {usingFallback ? (
                <Badge variant="outline">{t('fallbackBadge')}</Badge>
              ) : (
                <Badge variant="secondary">
                  {t('cachedBadge')}
                  {view.generatedAt ? ` · ${view.generatedAt.toISOString().slice(0, 10)}` : ''}
                </Badge>
              )}
              <GenerateButton meetingId={view.meeting.id} hasCache={!usingFallback} aiEnabled={aiEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <PrepList title={t('agenda')} items={prep.suggestedAgenda} empty={t('none')} />
          <PrepList title={t('questions')} items={prep.suggestedQuestions} empty={t('none')} />
          <PrepList title={t('challenges')} items={prep.challengesToDiscuss} empty={t('none')} />
          <PrepList title={t('resources')} items={prep.recommendedResources} empty={t('none')} />
        </CardContent>
      </Card>
    </div>
  );
}

function PrepList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="ml-4 list-disc space-y-1 text-sm">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
