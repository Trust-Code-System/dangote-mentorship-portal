import * as React from 'react';
import { cn } from '@/lib/utils';
import { CountUp } from '@/components/motion/count-up';

// StatTile (§19 §3/§8) — the admin "stat tiles row". A big tabular number under
// a micro eyebrow, optional status tone + delta hint. Numbers use Inter tabular
// figures so they don't jitter (§2).
const toneClass = {
  default: 'text-ink',
  ok: 'text-green-strong',
  warn: 'text-warn',
  risk: 'text-risk',
  info: 'text-info',
} as const;

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: keyof typeof toneClass;
  /** Override the value type size — use a smaller size for word/status values
   *  (e.g. "UNMATCHED") so they fit on one line instead of the big number size. */
  valueClassName?: string;
}

// The icon chip tints to match the tile's status tone (soft fill + brand-ink
// pairing), echoing the PulseHR stat cards. Default tone uses the brand green.
const chipClass = {
  default: 'bg-surface-2 text-ink-3',
  ok: 'bg-green-soft text-green',
  warn: 'bg-warn/10 text-warn',
  risk: 'bg-risk/10 text-risk',
  info: 'bg-info/10 text-info',
} as const;

function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
  valueClassName,
  ...props
}: StatTileProps) {
  // A zero "needs attention" count is good news; don't paint it red/amber.
  const isZero = value === 0 || value === '0';
  const effectiveTone = isZero && (tone === 'risk' || tone === 'warn') ? 'default' : tone;
  return (
    <div
      className={cn(
        'border-border bg-card shadow-elevation hover:shadow-elevation rounded-lg border p-5 transition-shadow duration-200 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-small text-ink-2 font-medium">{label}</span>
        {icon && (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4',
              chipClass[effectiveTone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {/* break-words + leading-tight keep long single-word values (e.g. status
          enums like "UNMATCHED") inside the tile instead of spilling out. */}
      <div
        className={cn(
          'mt-4 leading-tight font-semibold tracking-tight break-words tabular-nums',
          valueClassName ?? 'text-display',
          toneClass[effectiveTone],
        )}
      >
        {typeof value === 'number' ? <CountUp value={value} /> : value}
      </div>
      {hint && <div className="text-small text-ink-2 mt-1">{hint}</div>}
    </div>
  );
}

export { StatTile };
