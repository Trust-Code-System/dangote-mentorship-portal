import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Video, MoreVertical, ArrowRight, CalendarDays, FileText } from 'lucide-react';
import type { MenteeDashboard } from '@/features/dashboard/data';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from '@/components/ui/progress-ring';
import { WeeklyTip } from '@/components/dashboard/weekly-tip';

// Mentee "what matters now" bento (experience-layer.md §1.1 / Stitch redesign).
// Matches the Stitch Mentee Dashboard grid with REAL data only (clinics/resources
// are M4 and intentionally omitted — no fabricated cards): next-meeting widget
// with the mentor, active goals with progress rings, the weekly tip, and pending
// action items. Mobile-first, stacks to one column.
function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}
function fmtDateTime(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—';
}
function initialsOf(name?: string | null): string {
  const s = (name ?? '?').trim();
  const [a, b] = s.split(/\s+/).filter(Boolean);
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export async function MenteeSummary({ data }: { data: MenteeDashboard }) {
  const t = await getTranslations('dashboardCards');
  const ts = await getTranslations('sessions');
  const tg = await getTranslations('goals');

  return (
    <div className="grid gap-4 md:grid-cols-12">
      {/* Left column — next meeting + upcoming clinic */}
      <div className="flex flex-col gap-4 md:col-span-4">
      {/* Next meeting — with the matched mentor */}
      <section className="flex flex-1 flex-col rounded-lg border border-border bg-surface p-6 shadow-elevation">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-green-soft px-2.5 py-1 text-micro font-bold uppercase tracking-wider text-green-strong">
            {t('nextMeeting')}
          </span>
          <Link href="/meetings" className="text-micro font-bold text-green-light hover:underline">
            {t('all')}
          </Link>
        </div>

        <div className="mt-4 flex-1">
          {data.nextMeeting ? (
            <Link href={`/meetings/${data.nextMeeting.id}/prepare`} className="group block">
              <h3 className="text-h2 text-ink group-hover:text-green-strong">
                {data.nextMeeting.title}
              </h3>
              <p className="mt-1 text-body font-bold text-green">
                {fmtDateTime(data.nextMeeting.startsAt)}
              </p>
            </Link>
          ) : (
            <p className="text-small text-ink-3">{t('noNextMeeting')}</p>
          )}
        </div>

        {data.mentor ? (
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-green-soft text-small font-bold text-green-strong">
              {initialsOf(data.mentor.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-bold text-ink">{data.mentor.name ?? '—'}</p>
              {data.mentor.jobTitle ? (
                <p className="truncate text-small text-ink-2">{data.mentor.jobTitle}</p>
              ) : null}
            </div>
            <Link
              href="/pair"
              aria-label={t('openPair')}
              className="rounded-lg border border-green-strong bg-green p-2 text-white transition-colors duration-150 hover:bg-green-strong"
            >
              <Video className="size-5" />
            </Link>
          </div>
        ) : (
          <p className="mt-6 border-t border-border pt-4 text-small text-ink-3">{t('noMentor')}</p>
        )}
      </section>

      {/* Upcoming clinic (real data — deep-teal card, Stitch clinic card) */}
      {data.nextClinic ? (
        <section className="relative overflow-hidden rounded-lg bg-gradient-to-br from-green-strong via-green to-green-strong p-6 text-white shadow-elevation">
          <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-micro font-bold uppercase tracking-wider">
            {t('upcomingClinic')}
          </span>
          <h3 className="mt-3 text-h2 text-white">{data.nextClinic.title}</h3>
          {data.nextClinic.topic ? (
            <p className="mt-1 text-small text-green-soft">{data.nextClinic.topic}</p>
          ) : null}
          <p className="mt-3 flex items-center gap-2 text-small font-medium">
            <CalendarDays className="size-4" />
            {fmtDateTime(data.nextClinic.scheduledAt)}
          </p>
          {data.nextClinic.joinUrl ? (
            <a
              href={data.nextClinic.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-white py-2.5 text-small font-bold text-green-strong transition-colors hover:bg-green-soft"
            >
              {t('clinicJoin')}
            </a>
          ) : null}
        </section>
      ) : null}
      </div>

      {/* Active goals — circular progress */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-elevation md:col-span-5">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-h2 text-ink">{t('myGoals')}</h3>
          <Link
            href="/goals"
            className="inline-flex items-center gap-1 text-micro font-bold uppercase tracking-wider text-green-strong hover:underline"
          >
            {t('all')} <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {data.goals.length === 0 ? (
          <p className="text-small text-ink-3">{t('noGoals')}</p>
        ) : (
          <div className="space-y-4">
            {data.goals.map((g) => (
              <div key={g.id} className="flex items-center gap-4 rounded-xl bg-surface-2 p-3">
                <ProgressRing
                  value={g.percent}
                  size={56}
                  strokeWidth={6}
                  label={<span className="text-small font-bold text-green">{`${Math.round(g.percent)}%`}</span>}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{g.title}</p>
                  <Badge variant="neutral" className="mt-1">
                    {tg(`status.${g.status}`)}
                  </Badge>
                </div>
                <MoreVertical className="size-5 shrink-0 text-ink-3" aria-hidden />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Right column — weekly tip + new resources */}
      <div className="flex flex-col gap-4 md:col-span-3">
        <WeeklyTip />
        {data.resources.length > 0 ? (
          <section className="rounded-lg border border-border bg-surface p-6 shadow-elevation">
            <h3 className="mb-4 text-micro font-bold uppercase tracking-wider text-ink-2">
              {t('newResources')}
            </h3>
            <ul className="space-y-3">
              {data.resources.map((r) => {
                const inner = (
                  <span className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-soft text-green-strong">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-small font-bold text-ink">{r.title}</span>
                      {r.category ? (
                        <span className="block text-micro uppercase tracking-wider text-ink-3">
                          {r.category}
                        </span>
                      ) : null}
                    </span>
                  </span>
                );
                return (
                  <li key={r.id}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="block hover:opacity-80">
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      {/* Pending action items */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-elevation md:col-span-12">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-h2 text-ink">{t('myActions')}</h3>
          <Link href="/sessions" className="text-micro font-bold uppercase tracking-wider text-green-strong hover:underline">
            {t('all')}
          </Link>
        </div>
        {data.actionItems.length === 0 ? (
          <p className="text-small text-ink-3">{t('noActions')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.actionItems.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <span className="text-body text-ink">{a.title}</span>
                <span className="flex items-center gap-2 text-small">
                  {a.dueDate ? (
                    <span className={a.overdue ? 'font-bold text-risk' : 'text-ink-3'}>
                      {a.overdue ? ts('overdue') : ts('due')} {fmtDate(a.dueDate)}
                    </span>
                  ) : null}
                  <Badge variant="outline">{ts(`itemStatus.${a.status}`)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
