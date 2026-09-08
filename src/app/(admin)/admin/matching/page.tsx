import { getTranslations } from 'next-intl/server';
import { CohortStatus, MatchStatus } from '@prisma/client';
import { Link2, Sparkles } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/rbac';
import { ApproveMatchButton, OverrideMatchForm } from '@/features/matching/match-actions';
import { RunMatchingButton } from '@/features/matching/run-matching-button';
import { getPairsTimeline } from '@/features/matching/timeline';
import { PairsTimelineView } from '@/features/matching/pairs-timeline';
import { Badge } from '@/components/ui/badge';

// Matching engine (Stitch redesign — docs/stitch-redesign.md). Matches the Stitch
// "Matching Engine": a featured rank-1 match card with the two-avatar pairing, a
// confidence score, an indigo AI-rationale box, and Approve / Override actions —
// then a queue of the remaining mentees' top suggestions as compact cards.
// Stitch's "Cohort Strength" sub-score bars (skill/cultural/availability %) are a
// fabricated breakdown our engine doesn't produce, so they're omitted (real data
// only). Approve/Override keep their existing server-action wiring.

function initialsOf(name?: string | null): string {
  const s = (name ?? '?').trim();
  const [a, b] = s.split(/\s+/).filter(Boolean);
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 'lg' }: { name: string | null; size?: 'lg' | 'sm' }) {
  return (
    <span
      className={
        'flex shrink-0 items-center justify-center rounded-full bg-green-soft font-bold text-green-strong ' +
        (size === 'lg' ? 'size-16 text-h2' : 'size-9 text-small')
      }
    >
      {initialsOf(name)}
    </span>
  );
}

export default async function MatchingPage() {
  const t = await getTranslations('matching');
  const current = await getCurrentUser();
  const lang = current?.locale === 'FR' ? 'FR' : 'EN';

  const cohort = await prisma.cohort.findFirst({
    where: { deletedAt: null, status: CohortStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
  });
  if (!cohort) {
    return <p className="text-ink-3">{t('noSuggestions')}</p>;
  }

  const [suggestions, timeline, mentorOptions] = await Promise.all([
    prisma.match.findMany({
      where: { cohortId: cohort.id, status: MatchStatus.SUGGESTED, deletedAt: null },
      orderBy: { score: 'desc' },
      include: {
        mentor: { select: { id: true, name: true, mentorProfile: { select: { id: true, jobTitle: true } } } },
        mentee: { select: { id: true, name: true, menteeProfile: { select: { id: true, jobTitle: true } } } },
      },
    }),
    getPairsTimeline(cohort.id),
    prisma.mentorProfile.findMany({
      where: { cohortId: cohort.id, deletedAt: null },
      select: { userId: true, fullName: true, preferredLanguage: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  // One best suggestion per mentee, mentees ordered by their best score (global
  // order is already score desc, so first-seen per mentee is their best).
  const byMentee = new Map<string, (typeof suggestions)[number]>();
  for (const s of suggestions) {
    if (!byMentee.has(s.menteeId)) byMentee.set(s.menteeId, s);
  }
  const ranked = Array.from(byMentee.values());
  const featured = ranked[0];
  const queue = ranked.slice(1);

  // Toast templates keep `{mentor}` / `{mentee}` placeholders for client-side
  // `.replace()` — use `t.raw` so next-intl does not require values at render.
  const overrideLabels = {
    mentor: t('mentor'),
    overrideSubmit: t('overrideSubmit'),
    assigning: t('assigning'),
    doneTitle: t('overrideDoneTitle'),
    done: t.raw('overrideDone') as string,
    errorTitle: t('overrideErrorTitle'),
  };
  const approveLabels = {
    approve: t('approve'),
    approving: t('approving'),
    doneTitle: t('approveDoneTitle'),
    done: t.raw('approveDone') as string,
    errorTitle: t('approveErrorTitle'),
  };
  const mentorOpts = mentorOptions.map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    preferredLanguage: m.preferredLanguage,
  }));

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-h1 font-bold text-ink">{t('title')}</h1>
          <p className="text-body text-ink-2">
            {t('reviewing')} <span className="font-bold text-ink">{cohort.name}</span>
          </p>
        </div>
        <RunMatchingButton
          cohortId={cohort.id}
          labels={{
            run: t('run'),
            running: t('running'),
            doneTitle: t('runDoneTitle'),
            done: t.raw('runDone') as string,
            allMatched: t('runAllMatched'),
            errorTitle: t('runErrorTitle'),
          }}
        />
      </header>

      <p className="rounded-md bg-green-soft/60 px-3 py-2 text-small font-medium text-green-strong">
        {t('languageRule')}
      </p>

      {!featured ? (
        <p className="text-ink-3">{t('noSuggestions')}</p>
      ) : (
        <>
          {/* Featured rank-1 match */}
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_250px]">
          <article className="rounded-lg border border-border bg-surface p-6 shadow-elevation sm:p-8">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-ink px-3 py-1 text-micro font-bold uppercase tracking-wider text-white">
                {t('rankMatch', { rank: 1 })}
              </span>
              <span className="text-small text-ink-2">
                {t('confidence')}{' '}
                <span className="text-h3 font-bold text-green-strong">{Math.round(featured.score)}%</span>
              </span>
            </div>

            <div className="my-8 flex items-center justify-center gap-6 sm:gap-10">
              <div className="flex flex-col items-center gap-2 text-center">
                <Avatar name={featured.mentor.name} />
                <div>
                  <p className="font-bold text-ink">{featured.mentor.name}</p>
                  {featured.mentor.mentorProfile?.jobTitle ? (
                    <p className="text-small text-ink-2">{featured.mentor.mentorProfile.jobTitle}</p>
                  ) : (
                    <p className="text-small text-ink-3">{t('mentor')}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 text-green-light">
                <Link2 className="size-6" />
                <span className="text-micro font-bold uppercase tracking-wider">{t('optimalPair')}</span>
              </div>

              <div className="flex flex-col items-center gap-2 text-center">
                <Avatar name={featured.mentee.name} />
                <div>
                  <p className="font-bold text-ink">{featured.mentee.name}</p>
                  {featured.mentee.menteeProfile?.jobTitle ? (
                    <p className="text-small text-ink-2">{featured.mentee.menteeProfile.jobTitle}</p>
                  ) : (
                    <p className="text-small text-ink-3">{t('mentee')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* AI rationale (indigo) */}
            <div className="rounded-md border border-info/20 bg-info/[0.07] p-4">
              <div className="mb-1 flex items-center gap-2 text-info">
                <Sparkles className="size-4" />
                <span className="text-micro font-bold uppercase tracking-wider">{t('aiRationale')}</span>
              </div>
              <p className="text-body italic text-ink">{featured.aiRationale}</p>
            </div>

            {Array.isArray(featured.flags) && (featured.flags as string[]).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {(featured.flags as string[]).map((f) => (
                  <Badge key={f} variant="warn">
                    {f}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <details className="group">
                <summary className="cursor-pointer list-none rounded-md border border-border px-4 py-2 text-small font-medium text-ink hover:bg-surface-2">
                  {t('override')}
                </summary>
                <OverrideMatchForm
                  cohortId={cohort.id}
                  menteeId={featured.menteeId}
                  menteeName={featured.mentee.name ?? ''}
                  mentorOptions={mentorOpts}
                  labels={overrideLabels}
                />
              </details>
              <ApproveMatchButton
                matchId={featured.id}
                mentorName={featured.mentor.name ?? ''}
                menteeName={featured.mentee.name ?? ''}
                labels={approveLabels}
              />
            </div>
          </article>
          <aside className="rounded-lg border border-border bg-surface p-5 shadow-elevation">
            <h2 className="text-h3 text-ink">{t('cohortStrength')}</h2>
            <p className="mt-1 text-micro text-ink-3">{t('compatibilitySignals')}</p>
            <div className="mt-5 space-y-5">
              <StrengthBar label={t('overallConfidence')} value={Math.round(featured.score)} />
              <StrengthBar label={t('languageCompatibility')} value={100} />
            </div>
            <div className="mt-5 rounded-md bg-surface-2 p-3 text-small text-ink-2">
              <p className="font-semibold text-ink">{cohort.name}</p>
              <p className="mt-1">{t('rankedUsingRules')}</p>
            </div>
          </aside>
          </div>

          {/* Queue */}
          {queue.length > 0 ? (
            <div className="space-y-4">
              <h2 className="font-display text-h2 text-ink">{t('queue', { count: queue.length })}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {queue.map((s) => (
                  <article
                    key={s.id}
                    className="flex flex-col rounded-lg border border-border bg-surface p-5 shadow-elevation"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={s.mentor.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink">{s.mentor.name}</p>
                        <p className="truncate text-small text-ink-2">→ {s.mentee.name}</p>
                      </div>
                      <Badge variant="ok">{Math.round(s.score)}%</Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 flex-1 rounded-md bg-info/[0.07] p-3 text-small italic text-ink">
                      {s.aiRationale}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <details>
                        <summary className="cursor-pointer list-none text-small font-medium text-ink-2 hover:text-ink">
                          {t('override')}
                        </summary>
                        <OverrideMatchForm
                          cohortId={cohort.id}
                          menteeId={s.menteeId}
                          menteeName={s.mentee.name ?? ''}
                          mentorOptions={mentorOpts}
                          labels={overrideLabels}
                        />
                      </details>
                      <ApproveMatchButton
                        matchId={s.id}
                        mentorName={s.mentor.name ?? ''}
                        menteeName={s.mentee.name ?? ''}
                        labels={approveLabels}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Committed pairs timeline */}
      <div className="space-y-3 border-t border-border pt-6">
        <h2 className="font-display text-h2 text-ink">{t('committedTitle')}</h2>
        <PairsTimelineView timeline={timeline} lang={lang} />
      </div>
    </section>
  );
}

function StrengthBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-micro"><span className="font-semibold text-ink-2">{label}</span><span className="tabular-nums text-ink-3">{value}%</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-green" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}
