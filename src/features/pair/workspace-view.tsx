import Link from 'next/link';
import { Check, Download, FileText, MoreVertical, Sparkles, StickyNote } from 'lucide-react';
import type { PairWorkspace } from '@/features/pair/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STEPS = ['Agreement', 'Goal setting', 'Growth plan', 'Action plan', 'Closure'];

/** Presentational pair workspace — data is loaded by the route. */
export function PairWorkspaceView({ pair }: { pair: PairWorkspace }) {
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
  const agreement = pair.agreements[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-micro text-ink-3">Dashboard / Mentorship pair</p>
          <h1 className="mt-1 font-display text-h1 text-ink">Mentorship Master Agreement</h1>
          <p className="text-small text-ink-2">
            Strategic partnership for leadership development and institutional growth.
          </p>
        </div>
        <div className="flex -space-x-2">
          {[pair.mentor.name, pair.mentee.name].map((name) => (
            <span
              key={name}
              className="grid size-10 place-items-center rounded-full border-2 border-surface bg-green-soft text-small font-bold text-green-strong"
            >
              {initials(name)}
            </span>
          ))}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface px-6 py-4 shadow-elevation">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-small font-semibold text-ink">Partnership progress</p>
          <Badge variant="neutral">Phase 3: Review &amp; Grow</Badge>
        </div>
        <div className="relative">
          <div className="absolute left-4 right-4 top-4 h-px bg-border" />
          <ol className="relative flex justify-between">
            {STEPS.map((step, index) => (
              <li key={step} className="flex w-24 flex-col items-center gap-1.5 text-center">
                <span
                  className={`grid size-8 place-items-center rounded-full border-2 text-micro ${index < 2 ? 'border-green bg-green text-white' : index === 2 ? 'border-green bg-surface text-green' : 'border-border bg-surface text-ink-3'}`}
                >
                  {index < 2 ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="text-micro text-ink-2">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <nav className="flex gap-6 border-b border-border text-small font-semibold">
        <span className="border-b-2 border-green pb-3 text-green-strong">Agreement</span>
        <Link href="/goals" className="pb-3 text-ink-3 hover:text-ink">
          Goals &amp; vision
        </Link>
        <Link href="/sessions" className="pb-3 text-ink-3 hover:text-ink">
          Progress logs
        </Link>
        <Link href="/messages" className="pb-3 text-ink-3 hover:text-ink">
          Messages
        </Link>
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(240px,.8fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-surface p-5 shadow-elevation">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-h3 text-ink">Current contract: Year 1 Roadmap</h2>
                <p className="mt-1 text-small text-ink-3">Last updated {fmt(pair.lastSessionAt)}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/agreements">Edit</Link>
              </Button>
            </div>
            <div className="mt-5 space-y-5 text-small text-ink-2">
              <div>
                <p className="text-micro font-bold uppercase text-ink-3">Our shared purpose</p>
                <p className="mt-1">
                  Build a trusted partnership focused on practical leadership growth, clear
                  accountability, and measurable progress.
                </p>
              </div>
              <div>
                <p className="text-micro font-bold uppercase text-ink-3">Communication &amp; cadence</p>
                <p className="mt-1">
                  Monthly mentoring sessions with preparation, action tracking, and concise
                  follow-up notes.
                </p>
              </div>
              <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                <Metric label="Meetings held" value={String(pair.meetingCount)} />
                <Metric label="Sessions logged" value={String(pair.sessionCount)} />
                <Metric label="Active goals" value={String(pair.goals.length)} />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <Badge variant={agreement?.mentorSignedAt ? 'ok' : 'neutral'}>
                Mentor {agreement?.mentorSignedAt ? 'signed' : 'pending'}
              </Badge>
              <Badge variant={agreement?.menteeSignedAt ? 'ok' : 'neutral'}>
                Mentee {agreement?.menteeSignedAt ? 'signed' : 'pending'}
              </Badge>
              <span className="ml-auto text-micro text-ink-3">View full PDF</span>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-lg border border-border bg-surface p-5 shadow-elevation">
              <div className="flex items-center justify-between">
                <h3 className="text-h3">Top goal</h3>
                <Link href="/goals" className="text-micro font-bold text-green-strong">
                  View all
                </Link>
              </div>
              <p className="mt-4 text-small font-semibold">
                {pair.goals[0]?.title ?? 'Define your first development goal'}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full w-[72%] bg-green" />
              </div>
            </section>
            <section className="rounded-lg border border-border bg-surface p-5 shadow-elevation">
              <div className="flex items-center justify-between">
                <h3 className="text-h3">Recent session</h3>
                <Link href="/sessions" className="text-micro font-bold text-green-strong">
                  Open summary
                </Link>
              </div>
              <p className="mt-4 text-small font-semibold">
                {pair.nextMeeting?.title ?? 'Monthly mentoring session'}
              </p>
              <p className="mt-1 text-micro text-ink-3">{fmt(pair.lastSessionAt)}</p>
            </section>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-info/20 bg-info/[0.07] p-4">
            <p className="flex items-center gap-2 text-small font-bold text-info">
              <Sparkles className="size-4" /> AI suggested
            </p>
            <p className="mt-3 text-small italic text-ink-2">
              Your partnership has clear goals. Consider documenting one observable success measure
              before the next review.
            </p>
            <Button asChild size="sm" className="mt-4 w-full bg-info hover:bg-info/90">
              <Link href="/goals">Add an action item</Link>
            </Button>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-elevation">
            <div className="flex items-center justify-between">
              <h3 className="text-small font-bold">Shared library</h3>
              <MoreVertical className="size-4 text-ink-3" />
            </div>
            <ul className="mt-3 space-y-3 text-small">
              <FileRow title="Mentoring agreement" icon={<FileText className="size-4" />} />
              <FileRow title="Growth action plan" icon={<StickyNote className="size-4" />} />
              <FileRow title="Session notes" icon={<Download className="size-4" />} />
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-elevation">
            <h3 className="text-small font-bold">Sticky note</h3>
            <div className="mt-3 rounded-md bg-[#fff8df] p-3 text-small italic text-ink-2">
              Remember to discuss the next leadership stretch assignment.
            </div>
            <p className="mt-2 text-right text-micro font-semibold text-green-strong">Edit note</p>
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
      <p className="text-micro uppercase text-ink-3">{label}</p>
      <p className="mt-1 text-h2 text-green-strong">{value}</p>
    </div>
  );
}

function FileRow({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-ink-2">
      <span className="text-green-light">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <MoreVertical className="size-3.5 text-ink-3" />
    </li>
  );
}
