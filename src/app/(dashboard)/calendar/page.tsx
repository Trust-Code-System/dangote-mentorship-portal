import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import { getCalendarEvents } from '@/features/calendar/data';
import {
  CALENDAR_VIEWS,
  groupByDay,
  isCalendarView,
  monthGrid,
  parseAnchor,
  rangeForView,
  step,
  weekDays,
  ymd,
  type CalendarEvent,
  type CalendarView,
} from '@/features/calendar/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Calendar (experience-layer.md §1.12): month / week / list over the user's
// meetings + programme milestones, navigated entirely via URL params so it stays
// server-rendered and fast. The Outlook write-path lands in the meetings feature.
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { view: rawView, date: rawDate } = await searchParams;
  const user = await requireUser();
  const t = await getTranslations('calendar');

  const view: CalendarView = isCalendarView(rawView) ? rawView : 'month';
  const anchor = parseAnchor(rawDate);
  const { start, end } = rangeForView(view, anchor);

  const events = await getCalendarEvents(user, start, end, { start: t('milestoneStart'), end: t('milestoneEnd') });
  const grouped = groupByDay(events);

  const href = (v: CalendarView, d: Date) => `/calendar?view=${v}&date=${ymd(d)}`;
  const prev = step(view, anchor, -1);
  const next = step(view, anchor, 1);

  const monthLabel = `${t(`months.m${anchor.getUTCMonth()}`)} ${anchor.getUTCFullYear()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-1">
          {CALENDAR_VIEWS.map((v) => (
            <Button key={v} asChild size="sm" variant={v === view ? 'default' : 'outline'}>
              <Link href={href(v, anchor)}>{t(`view.${v}`)}</Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{monthLabel}</span>
        <div className="flex gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link href={href(view, prev)} aria-label={t('previous')}>
              ←
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={href(view, new Date())}>{t('today')}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={href(view, next)} aria-label={t('next')}>
              →
            </Link>
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : null}

      {view === 'list' ? <ListView grouped={grouped} t={t} /> : null}
      {view === 'week' ? <WeekView anchor={anchor} grouped={grouped} t={t} /> : null}
      {view === 'month' ? <MonthView anchor={anchor} grouped={grouped} /> : null}
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function fmtTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

function EventRow({ e }: { e: CalendarEvent }) {
  const body = (
    <span className="flex items-center gap-2">
      <Badge variant={e.type === 'milestone' ? 'secondary' : 'outline'}>{fmtTime(e.start)}</Badge>
      <span>{e.title}</span>
    </span>
  );
  return e.link ? (
    <Link href={e.link} className="block rounded-md px-2 py-1 text-sm hover:bg-accent">
      {body}
    </Link>
  ) : (
    <span className="block px-2 py-1 text-sm">{body}</span>
  );
}

function weekdayName(t: T, date: Date): string {
  // getUTCDay: 0=Sun..6=Sat; our keys are d0=Mon..d6=Sun.
  const idx = (date.getUTCDay() + 6) % 7;
  return t(`weekdaysShort.d${idx}`);
}

function ListView({ grouped, t }: { grouped: Map<string, CalendarEvent[]>; t: T }) {
  const days = [...grouped.keys()].sort();
  return (
    <div className="space-y-4">
      {days.map((key) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {weekdayName(t, new Date(`${key}T00:00:00Z`))} · {key}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {grouped.get(key)!.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WeekView({ anchor, grouped, t }: { anchor: Date; grouped: Map<string, CalendarEvent[]>; t: T }) {
  const days = weekDays(anchor);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {days.map((d) => {
        const key = ymd(d);
        const list = grouped.get(key) ?? [];
        return (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {weekdayName(t, d)} · {key.slice(5)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {list.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">—</p>
              ) : (
                list.map((e) => <EventRow key={e.id} e={e} />)
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, grouped }: { anchor: Date; grouped: Map<string, CalendarEvent[]> }) {
  const weeks = monthGrid(anchor);
  const month = anchor.getUTCMonth();
  const todayKey = ymd(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-lg border bg-border">
        {weeks.flat().map((d) => {
          const key = ymd(d);
          const list = grouped.get(key) ?? [];
          const inMonth = d.getUTCMonth() === month;
          return (
            <div
              key={key}
              className={cn('min-h-24 bg-card p-1.5', !inMonth && 'bg-muted/40 text-muted-foreground')}
            >
              <div className={cn('mb-1 text-xs', key === todayKey && 'font-bold text-primary')}>
                {d.getUTCDate()}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((e) =>
                  e.link ? (
                    <Link
                      key={e.id}
                      href={e.link}
                      className={cn(
                        'block truncate rounded px-1 text-[11px] hover:underline',
                        e.type === 'milestone' ? 'bg-secondary' : 'bg-accent',
                      )}
                      title={e.title}
                    >
                      {e.title}
                    </Link>
                  ) : (
                    <span
                      key={e.id}
                      className={cn(
                        'block truncate rounded px-1 text-[11px]',
                        e.type === 'milestone' ? 'bg-secondary' : 'bg-accent',
                      )}
                      title={e.title}
                    >
                      {e.title}
                    </span>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
