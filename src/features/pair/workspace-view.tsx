import Link from 'next/link';
import { ArrowUpRight, Check, FileText, StickyNote } from 'lucide-react';
import type { PairWorkspace } from '@/features/pair/data';
import { pairProgress } from './progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/** Presentational pair workspace — data is loaded by the route. */
export function PairWorkspaceView({ pair }: { pair: PairWorkspace }) {
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
  const progress = pairProgress(pair);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-micro text-ink-3">Dashboard / Mentorship pair</p>
          <h1 className="font-display text-h1 text-ink mt-1 font-semibold tracking-tight">
            Mentorship Master Agreement
          </h1>
          <p className="text-small text-ink-2">
            Strategic partnership for leadership development and institutional growth.
          </p>
        </div>
        <div className="flex -space-x-2">
          {[pair.mentor.name, pair.mentee.name].map((name) => (
            <span
              key={name}
              className="border-surface bg-green-soft text-small text-green-strong grid size-10 place-items-center rounded-full border-2 font-bold"
            >
              {initials(name)}
            </span>
          ))}
        </div>
      </header>

      <section className="border-border bg-surface shadow-elevation rounded-lg border px-6 py-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-small text-ink font-semibold">Partnership progress</p>
          <Badge variant="neutral">
            {progress.current?.label ?? 'Partnership complete'} · {progress.progressPercent}%
          </Badge>
        </div>
        <div className="relative">
          <div className="bg-border absolute top-4 right-4 left-4 h-px" />
          <ol className="relative flex justify-between">
            {progress.steps.map((step, index) => (
              <li
                key={step.key}
                className="flex w-24 min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <Link
                  href={step.href}
                  aria-label={`${step.label} — ${step.completed ? 'completed' : progress.current?.key === step.key ? 'current step' : 'pending'}`}
                  aria-current={progress.current?.key === step.key ? 'step' : undefined}
                  title={step.hint}
                  className={`text-micro grid size-8 place-items-center rounded-full border-2 ${step.completed ? 'border-green bg-green text-white' : progress.current?.key === step.key ? 'border-green bg-surface text-green' : 'border-border bg-surface text-ink-3'}`}
                >
                  {step.completed ? <Check className="size-4" /> : index + 1}
                </Link>
                <span className="text-micro text-ink-2">{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <nav className="border-border text-small flex gap-6 border-b font-semibold">
        <span className="border-green text-green-strong border-b-2 pb-3">Agreement</span>
        <Link href="/goals" className="text-ink-3 hover:text-ink pb-3">
          Goals &amp; vision
        </Link>
        <Link href="/sessions" className="text-ink-3 hover:text-ink pb-3">
          Progress logs
        </Link>
        <Link href="/messages" className="text-ink-3 hover:text-ink pb-3">
          Messages
        </Link>
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(240px,.8fr)]">
        <div className="space-y-4">
          <section className="border-border bg-surface shadow-elevation rounded-lg border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-h3 text-ink">{pair.cohortName}</h2>
                <p className="text-small text-ink-3 mt-1">Partnership overview</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/agreements">Edit</Link>
              </Button>
            </div>
            <div className="text-small text-ink-2 mt-5 space-y-5">
              <div>
                <p className="text-micro text-ink-3 font-bold uppercase">Our shared purpose</p>
                <p className="mt-1">
                  Build a trusted partnership focused on practical leadership growth, clear
                  accountability, and measurable progress.
                </p>
              </div>
              <div>
                <p className="text-micro text-ink-3 font-bold uppercase">
                  Communication &amp; cadence
                </p>
                <p className="mt-1">
                  Monthly mentoring sessions with preparation, action tracking, and concise
                  follow-up notes.
                </p>
              </div>
              <div className="border-border grid gap-3 border-t pt-4 sm:grid-cols-3">
                <Metric label="Meetings held" value={String(pair.meetingCount)} />
                <Metric label="Sessions logged" value={String(pair.sessionCount)} />
                <Metric label="Shared goals" value={String(pair.goals.length)} />
              </div>
            </div>
            <div className="border-border mt-5 space-y-3 border-t pt-4">
              {pair.agreements.map((agreement) => (
                <div key={agreement.type} className="flex flex-wrap items-center gap-2">
                  <span className="text-small mr-auto">
                    {agreement.type === 'MENTORING'
                      ? 'Mentoring agreement'
                      : 'Confidentiality agreement'}
                  </span>
                  <Badge variant={agreement.mentorSignedAt ? 'ok' : 'neutral'}>
                    Mentor {agreement.mentorSignedAt ? 'signed' : 'pending'}
                  </Badge>
                  <Badge variant={agreement.menteeSignedAt ? 'ok' : 'neutral'}>
                    Mentee {agreement.menteeSignedAt ? 'signed' : 'pending'}
                  </Badge>
                </div>
              ))}
              <Link
                href="/agreements"
                className="text-micro text-green-strong font-semibold underline underline-offset-4"
              >
                View agreements and available PDFs
              </Link>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="border-border bg-surface shadow-elevation rounded-lg border p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-h3">Top goal</h3>
                <Link href="/goals" className="text-micro text-green-strong font-bold">
                  View all
                </Link>
              </div>
              <p className="text-small mt-4 font-semibold">
                {pair.goals[0]?.title ?? 'Define your first development goal'}
              </p>
              <div
                role="progressbar"
                aria-label="Top goal progress"
                aria-valuenow={progress.topGoalPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="bg-surface-2 mt-3 h-1.5 overflow-hidden rounded-full"
              >
                <div className="bg-green h-full" style={{ width: `${progress.topGoalPercent}%` }} />
              </div>
              <p className="text-micro text-ink-3 mt-2">{progress.topGoalPercent}% complete</p>
            </section>
            <section className="border-border bg-surface shadow-elevation rounded-lg border p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-h3">Recent session</h3>
                <Link href="/sessions" className="text-micro text-green-strong font-bold">
                  Open summary
                </Link>
              </div>
              <p className="text-small mt-4 font-semibold">
                {pair.latestSession?.title ?? 'No session has been logged yet'}
              </p>
              <p className="text-micro text-ink-3 mt-1">{fmt(pair.latestSession?.date ?? null)}</p>
            </section>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="border-info/20 bg-info/[0.07] rounded-lg border p-4">
            <p className="text-small text-info flex items-center gap-2 font-bold">
              <ArrowUpRight className="size-4" /> Next step
            </p>
            <p className="text-small text-ink-2 mt-3 italic">
              {progress.current?.hint ??
                'Your programme requirements are complete. View your certificate.'}
            </p>
            <Button asChild size="sm" className="bg-info hover:bg-info/90 mt-4 w-full">
              <Link href={progress.current?.href ?? '/certificate'}>
                {progress.current
                  ? `Open ${progress.current.label.toLowerCase()}`
                  : 'View certificate'}
              </Link>
            </Button>
          </section>

          <section className="border-border bg-surface shadow-elevation rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-small font-bold">Workspace shortcuts</h3>
            </div>
            <ul className="text-small mt-3 space-y-3">
              <FileRow
                title="Mentoring agreement"
                href="/agreements"
                icon={<FileText className="size-4" />}
              />
              <FileRow
                title="Growth action plan"
                href="/goals"
                icon={<StickyNote className="size-4" />}
              />
              <FileRow
                title="Session notes and actions"
                href="/sessions"
                icon={<FileText className="size-4" />}
              />
            </ul>
          </section>

          <section className="border-border bg-surface shadow-elevation rounded-lg border p-4">
            <h3 className="text-small font-bold">Your journal</h3>
            <p className="text-small text-ink-2 mt-3">
              Save your reflections{pair.role === 'mentor' ? ' and private mentor notes' : ''} in
              your journal.
            </p>
            <Link
              href="/journal"
              className="text-small text-green-strong mt-3 inline-flex min-h-11 items-center font-semibold"
            >
              Open journal <ArrowUpRight className="ml-1 size-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function initials(name: string | null) {
  return (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-micro text-ink-3 uppercase">{label}</p>
      <p className="text-h2 text-green-strong mt-1">{value}</p>
    </div>
  );
}

function FileRow({ title, icon, href }: { title: string; icon: React.ReactNode; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="text-ink-2 hover:text-green-strong flex min-h-11 items-center gap-2"
      >
        <span className="text-green-light">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ArrowUpRight className="text-ink-3 size-3.5" />
      </Link>
    </li>
  );
}
