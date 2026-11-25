import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowUpRight, ArrowRight, CalendarDays, Users, Video } from 'lucide-react';
import type { MentorDashboard } from '@/features/dashboard/data';
import { MetricBand } from './metric-band';

function initials(name: string | null) {
  return (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
}

export async function MentorSummary({ data }: { data: MentorDashboard }) {
  const t = await getTranslations('dashboardCards');
  const tc = await getTranslations('common');
  const w = await getTranslations('workspace');
  const locale = await getLocale();
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
  return (
    <div className="space-y-6">
      <MetricBand
        items={[
          {
            href: '/pair',
            label: t('myMentees'),
            value: data.mentees.length,
            hint: w('peopleYouGuide'),
          },
          {
            href: '/goals',
            label: t('pendingReviews'),
            value: data.pendingReviewCount,
            hint: t('pendingReviewsHint'),
          },
          {
            href: '/sessions',
            label: t('logsAwaiting'),
            value: data.logsAwaiting,
            hint: t('logsAwaitingHint'),
          },
        ]}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_1fr]">
        <section className="workspace-section overflow-hidden">
          <div className="workspace-section-heading">
            <h2>
              {t('myMentees')} <span className="text-ink-3 ml-2">{data.mentees.length}</span>
            </h2>
            <Link href="/pair" className="workspace-link">
              {t('all')}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {data.mentees.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
              <Users className="text-ink-3 size-7" />
              <p className="text-small text-ink-3 max-w-sm">{t('noMentees')}</p>
            </div>
          ) : (
            <div className="divide-border/70 divide-y">
              {data.mentees.map((m) => (
                <Link
                  key={m.id}
                  href={`/pair/${m.id}`}
                  className="group hover:bg-surface-2/60 flex items-center gap-4 px-6 py-5 transition-colors"
                >
                  <span className="border-border bg-surface-2 text-small text-ink grid size-11 shrink-0 place-items-center rounded-full border font-medium">
                    {initials(m.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate font-semibold">{m.name ?? '—'}</span>
                    <span className="text-ink-3 mt-1 block text-xs">
                      {m.language === 'FR'
                        ? tc('french')
                        : m.language === 'EN'
                          ? tc('english')
                          : w('mentee')}
                    </span>
                  </span>
                  <span className="text-ink-3 hidden text-xs sm:block">{w('viewProgress')}</span>
                  <ArrowRight className="text-ink-3 size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="workspace-section overflow-hidden">
          <div className="workspace-section-heading">
            <h2>{t('nextMeetings')}</h2>
            <Link href="/meetings" className="workspace-link">
              {t('all')}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="p-5">
            {data.nextMeetings.length === 0 ? (
              <div className="flex min-h-36 flex-col items-start justify-center gap-3">
                <span className="border-border grid size-10 place-items-center rounded-lg border">
                  <CalendarDays className="text-ink-3 size-5" />
                </span>
                <p className="text-small text-ink-3 max-w-xs leading-relaxed">
                  {t('noNextMeeting')}
                </p>
                <Link href="/meetings" className="workspace-link !text-green">
                  {w('scheduleSession')}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {data.nextMeetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}/prepare`}
                    className="hover:bg-surface-2 flex items-start gap-3 rounded-lg p-3 transition-colors"
                  >
                    <span className="bg-green-soft mt-1 grid size-9 shrink-0 place-items-center rounded-lg">
                      <Video className="text-green size-4" />
                    </span>
                    <span>
                      <span className="text-small block font-semibold">{m.title}</span>
                      <span className="text-ink-3 mt-1 block text-xs">{m.counterpartName}</span>
                      <span className="text-green mt-2 block text-xs">
                        {m.startsAt ? date.format(m.startsAt) : '—'}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
