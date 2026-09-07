import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AlertTriangle, ClipboardCheck, Lock } from 'lucide-react';
import type { AssessmentGate } from './gate';

// Persistent status strip for the quarterly assessment, rendered in the
// authenticated shell. It escalates with the gate state so nobody is locked out
// by surprise: a quiet prompt while the window is open, a warning once it is
// overdue with the exact lock date, and an explanation once locked.
export async function AssessmentGateBanner({ gate }: { gate: AssessmentGate }) {
  if (gate.state === 'CLEAR' || !gate.window) return null;

  const [t, format] = await Promise.all([getTranslations('assessments'), getFormatter()]);
  const dueDate = format.dateTime(gate.window.dueAt, { dateStyle: 'medium' });
  const lockDate = gate.lockAt ? format.dateTime(gate.lockAt, { dateStyle: 'medium' }) : '';
  const days = Math.max(0, gate.daysUntilLock ?? 0);

  const tone =
    gate.state === 'LOCKED'
      ? 'border-risk/40 bg-risk/10 text-risk'
      : gate.state === 'GRACE'
        ? 'border-warn/40 bg-warn/10 text-ink'
        : 'border-border bg-surface-2 text-ink';

  const Icon =
    gate.state === 'LOCKED' ? Lock : gate.state === 'GRACE' ? AlertTriangle : ClipboardCheck;

  const message =
    gate.state === 'LOCKED'
      ? t('bannerLocked')
      : gate.state === 'GRACE'
        ? t('bannerGrace', { days, lockDate })
        : t('bannerDue', { dueDate });

  return (
    <div
      className={`mb-6 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-small ${tone}`}
      role={gate.state === 'DUE' ? 'status' : 'alert'}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">
        <span className="font-semibold">{gate.window.label}</span> — {message}
      </p>
      <Link
        href="/assessment"
        className="rounded-md border border-current px-3 py-1.5 font-semibold underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-green/30"
      >
        {t('bannerCta')}
      </Link>
    </div>
  );
}
