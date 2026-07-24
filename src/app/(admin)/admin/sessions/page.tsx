import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NotebookPen } from 'lucide-react';
import { getProgrammeSessionLogs, type AdminSessionLogRow } from '@/features/admin/overview-data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

// Programme-wide, read-only view of the session reports mentors file (RBAC §4:
// admins may *view* session logs). The admin-area layout already gates to admin
// roles. Mentor-private notes are excluded upstream in getProgrammeSessionLogs;
// mentors keep their own editable read-back on the /sessions page.
export default async function AdminSessionsPage() {
  const [tList, tSess] = await Promise.all([
    getTranslations('adminLists'),
    getTranslations('sessions'),
  ]);
  const logs = await getProgrammeSessionLogs();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-h1 text-ink">{tList('sessionsTitle')}</h1>
        <p className="text-body text-ink-2">{tList('sessionsSubtitle')}</p>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="size-6" aria-hidden />}
          title={tList('noSessions')}
          description={tList('sessionsSubtitle')}
        />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <AdminSessionLogCard key={log.id} log={log} tSess={tSess} tList={tList} />
          ))}
        </div>
      )}
    </section>
  );
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

function AdminSessionLogCard({
  log,
  tSess,
  tList,
}: {
  log: AdminSessionLogRow;
  tSess: Translate;
  tList: Translate;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {fmtDate(log.date)}
            {log.time ? ` · ${log.time}` : ''}
          </CardTitle>
          <div className="flex flex-wrap gap-1">
            {log.meetingType ? <Badge variant="outline">{tSess(`type.${log.meetingType}`)}</Badge> : null}
            {log.competencyDiscussed ? <Badge variant="secondary">{log.competencyDiscussed}</Badge> : null}
            <Badge variant="outline">{log.cohortName}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <NameLink name={log.mentorName} href={log.mentorProfileId ? `/admin/mentors/${log.mentorProfileId}` : null} />
          {' → '}
          <NameLink name={log.menteeName} href={log.menteeProfileId ? `/admin/mentees/${log.menteeProfileId}` : null} />
        </p>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {log.summary ? <p className="whitespace-pre-wrap">{log.summary}</p> : null}

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {log.goalDiscussed ? <Detail label={tSess('goalDiscussed')} value={log.goalDiscussed} /> : null}
          {log.actionsAgreed ? <Detail label={tSess('actionsAgreed')} value={log.actionsAgreed} /> : null}
          {log.challenges ? <Detail label={tSess('challenges')} value={log.challenges} /> : null}
          {log.nextActionPlan ? <Detail label={tSess('nextActionPlan')} value={log.nextActionPlan} /> : null}
          {log.resourcesNeeded ? <Detail label={tSess('resourcesNeeded')} value={log.resourcesNeeded} /> : null}
          {log.timeline ? <Detail label={tSess('timeline')} value={log.timeline} /> : null}
          {log.nextMeetingDate ? (
            <Detail label={tSess('nextMeetingDate')} value={fmtDate(log.nextMeetingDate)} />
          ) : null}
        </dl>

        {log.menteeReflection ? (
          <div className="border-t pt-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tSess('menteeReflection')}</p>
            <p className="whitespace-pre-wrap">{log.menteeReflection}</p>
          </div>
        ) : null}

        {!log.summary && !log.actionsAgreed && !log.challenges && !log.nextActionPlan ? (
          <p className="text-xs text-muted-foreground">{tList('sessionEmpty')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NameLink({ name, href }: { name: string | null; href: string | null }) {
  const label = name ?? '—';
  if (!href) return <span className="font-medium text-ink-2">{label}</span>;
  return (
    <Link href={href} className="font-medium text-green hover:text-green-strong hover:underline">
      {label}
    </Link>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
