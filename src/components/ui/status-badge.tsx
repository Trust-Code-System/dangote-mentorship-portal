import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// StatusBadge — the reference-led status treatment for tables and lists
// (Samir's document table: a small tone dot + a sentence-case label, no filled
// pill). It replaces raw enum strings such as `IN_PROGRESS` or `NOT_STARTED`
// with translated labels from the `statusLabel` namespace (EN/FR).
//
// Tones are functional only (§1): ok = done/healthy, info = moving, warn =
// needs a nudge, risk = failed/refused, neutral = inert or descriptive.

type Tone = 'ok' | 'info' | 'warn' | 'risk' | 'neutral';

const TONE_BY_STATUS: Record<string, Tone> = {
  ACTIVE: 'ok',
  COMPLETED: 'ok',
  MATCHED: 'ok',
  VALIDATED: 'ok',
  COMMITTED: 'ok',
  ACCEPTED: 'ok',
  APPROVED: 'ok',
  IN_PROGRESS: 'info',
  SUBMITTED: 'info',
  SUGGESTED: 'info',
  SCHEDULED: 'info',
  VALIDATING: 'info',
  PENDING: 'warn',
  NOT_STARTED: 'warn',
  UNMATCHED: 'warn',
  FAILED: 'risk',
  REJECTED: 'risk',
  EXPIRED: 'risk',
};

// One accent (forest). "Moving" statuses use a half-strength accent rather
// than a second hue, so in-progress reads as "on the way to done".
const DOT: Record<Tone, string> = {
  ok: 'bg-green-light',
  info: 'bg-green-light/45 ring-1 ring-green-light/60',
  warn: 'bg-warn',
  risk: 'bg-risk',
  neutral: 'bg-ink-3',
};

const KNOWN = new Set([
  ...Object.keys(TONE_BY_STATUS),
  'DRAFT',
  'ARCHIVED',
  'REVOKED',
  'CANCELLED',
  'ZOOM',
  'PHYSICAL',
  'PHONE',
  'TEAMS',
  'MEET',
]);

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  /** Override the default tone for this status (e.g. a meeting type stays neutral). */
  tone?: Tone;
  className?: string;
}) {
  const t = useTranslations('statusLabel');
  const resolved = tone ?? TONE_BY_STATUS[status] ?? 'neutral';
  // Unknown values still render readably rather than as SHOUTED_SNAKE_CASE.
  const label = KNOWN.has(status)
    ? t(status)
    : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-small font-medium text-ink-2',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT[resolved])} />
      {label}
    </span>
  );
}
