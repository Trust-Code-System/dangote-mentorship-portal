import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Circle,
  FileText,
  Target,
  Video,
} from 'lucide-react';
import type { MenteeDashboard } from '@/features/dashboard/data';
import { Badge } from '@/components/ui/badge';
import { WeeklyTip } from './weekly-tip';
import { MetricBand } from './metric-band';

function initials(name?: string | null) {
  return (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
}

export async function MenteeSummary({ data }: { data: MenteeDashboard }) {
  const t = await getTranslations('dashboardCards');
  const ts = await getTranslations('sessions');
  const tg = await getTranslations('goals');
  const w = await getTranslations('workspace');
  const locale = await getLocale();
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const time = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
  const progress = data.goals.length
    ? Math.round(data.goals.reduce((a, g) => a + g.percent, 0) / data.goals.length)
    : 0;
  return (
    <div className="space-y-6">
      <MetricBand
        items={[
          { href: '/goals', label: w('activeGoals'), value: data.goals.length },
          { href: '/sessions', label: w('yourNextSteps'), value: data.actionItems.length },
          {
            href: '/goals',
            label: w('goalProgress'),
            hint: w('goalProgressHint'),
            value: `${progress}%`,
            progress,
          },
        ]}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-6">
          <section className="workspace-section overflow-hidden">
            <div className="workspace-section-heading">
              <h2>{t('myGoals')}</h2>
              <Link href="/goals" className="workspace-link">
                {t('all')}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            {data.goals.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-7 text-center">
                <span className="border-border grid size-11 place-items-center rounded-xl border">
                  <Target className="text-ink-3 size-5" />
                </span>
                <p className="text-small text-ink-3">{t('noGoals')}</p>
                <Link href="/goals" className="workspace-link !text-green">
                  {w('noGoalCta')}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <div className="divide-border/70 divide-y">
                {data.goals.map((g) => (
                  <Link
                    key={g.id}
                    href="/goals"
                    className="hover:bg-surface-2/50 block px-6 py-5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-ink font-semibold">{g.title}</p>
                        <Badge variant="neutral" className="mt-2">
                          {tg(`status.${g.status}`)}
                        </Badge>
                      </div>
                      <span className="text-small text-ink-2 font-medium tabular-nums">
                        {Math.round(g.percent)}%
                      </span>
                    </div>
                    <div
                      aria-label={`${Math.round(g.percent)}%`}
                      role="progressbar"
                      aria-valuenow={g.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="bg-surface-2 mt-4 h-1.5 overflow-hidden rounded-full"
                    >
                      <div
                        className="bg-green/75 h-full rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, g.percent))}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="workspace-section overflow-hidden">
            <div className="workspace-section-heading">
              <h2>{t('myActions')}</h2>
              <Link href="/sessions" className="workspace-link">
                {t('all')}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            {data.actionItems.length === 0 ? (
              <p className="text-small text-ink-3 px-6 py-8">{t('noActions')}</p>
            ) : (
              <ul className="divide-border/70 divide-y">
                {data.actionItems.map((a) => (
                  <li key={a.id}>
                    <Link
                      href="/sessions"
                      className="hover:bg-surface-2/50 flex items-start gap-3 px-6 py-4 transition-colors"
                    >
                      <Circle className="text-ink-3/60 mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="text-small block font-medium">{a.title}</span>
                        <span className="text-ink-3 mt-1 block text-xs">
                          {ts(`itemStatus.${a.status}`)}
                        </span>
                      </span>
                      {a.dueDate ? (
                        <span
                          className={`shrink-0 text-xs ${a.overdue ? 'text-risk' : 'text-ink-3'}`}
                        >
                          {a.overdue ? ts('overdue') : ts('due')} {date.format(a.dueDate)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-6">
          <section className="workspace-section overflow-hidden">
            <div className="workspace-section-heading">
              <h2>{t('nextMeeting')}</h2>
              <CalendarDays className="text-ink-3 size-4" />
            </div>
            <div className="p-6">
              {data.nextMeeting ? (
                <Link href={`/meetings/${data.nextMeeting.id}/prepare`} className="block">
                  <p className="text-green text-xs font-medium">
                    {data.nextMeeting.startsAt ? time.format(data.nextMeeting.startsAt) : '—'}
                  </p>
                  <h3 className="text-ink mt-3 text-lg leading-snug font-semibold">
                    {data.nextMeeting.title}
                  </h3>
                  <span className="workspace-link mt-4">
                    {w('viewProgress')}
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              ) : (
                <>
                  <p className="text-small text-ink-3 leading-relaxed">{t('noNextMeeting')}</p>
                  <Link href="/meetings" className="workspace-link !text-green mt-4">
                    {w('scheduleSession')}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </>
              )}
              {data.mentor ? (
                <Link
                  href="/pair"
                  className="border-border mt-6 flex items-center gap-3 border-t pt-5"
                >
                  <span className="bg-green-soft text-small text-green grid size-10 shrink-0 place-items-center rounded-full font-semibold">
                    {initials(data.mentor.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-3 block text-[11px]">{w('yourMentor')}</span>
                    <span className="text-small block truncate font-semibold">
                      {data.mentor.name}
                    </span>
                    {data.mentor.jobTitle ? (
                      <span className="text-ink-3 block truncate text-xs">
                        {data.mentor.jobTitle}
                      </span>
                    ) : null}
                  </span>
                  <Video className="text-ink-3 size-4" />
                </Link>
              ) : (
                <p className="border-border text-small text-ink-3 mt-6 border-t pt-4">
                  {t('noMentor')}
                </p>
              )}
            </div>
          </section>
          {data.nextClinic ? (
            <section className="border-green/15 bg-green-soft/60 rounded-lg border p-6">
              <p className="text-green text-xs font-medium">{t('upcomingClinic')}</p>
              <h3 className="text-ink mt-2 text-lg font-semibold">{data.nextClinic.title}</h3>
              {data.nextClinic.topic ? (
                <p className="text-small text-ink-2 mt-2">{data.nextClinic.topic}</p>
              ) : null}
              <p className="text-ink-2 mt-4 text-xs">
                {data.nextClinic.scheduledAt ? time.format(data.nextClinic.scheduledAt) : '—'}
              </p>
              {data.nextClinic.joinUrl ? (
                <a
                  href={data.nextClinic.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="workspace-link !text-green mt-4"
                >
                  {t('clinicJoin')}
                  <ArrowUpRight className="size-3.5" />
                </a>
              ) : null}
            </section>
          ) : null}
          <WeeklyTip />
          {data.resources.length ? (
            <section className="workspace-section">
              <div className="workspace-section-heading">
                <h2>{t('newResources')}</h2>
              </div>
              <ul className="space-y-4 p-5">
                {data.resources.map((r) => (
                  <li key={r.id}>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-small hover:text-green flex items-start gap-3"
                      >
                        <FileText className="text-ink-3 mt-0.5 size-4 shrink-0" />
                        <span>
                          <span className="block font-medium">{r.title}</span>
                          {r.category ? (
                            <span className="text-ink-3 mt-1 block text-xs">{r.category}</span>
                          ) : null}
                        </span>
                        <ArrowUpRight className="ml-auto size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-small">{r.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
