import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function MetricBand({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string; href: string; progress?: number }[];
}) {
  return (
    <div className="workspace-section grid grid-cols-2 overflow-hidden sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="workspace-metric group hover:bg-surface-2/60 focus-visible:ring-green/50 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-small text-ink-2 font-medium">{item.label}</p>
            <ArrowUpRight className="text-ink-3/60 size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
          </div>
          <p className="text-ink mt-4 text-[32px] leading-none font-semibold tracking-[-.045em] tabular-nums">
            {item.value}
          </p>
          {item.progress !== undefined ? (
            <div aria-hidden="true" className="workspace-progress-track mt-4">
              {Array.from({ length: 24 }, (_, i) => (
                <i
                  key={i}
                  data-filled={
                    i < Math.round((Math.max(0, Math.min(100, item.progress!)) / 100) * 24)
                  }
                />
              ))}
            </div>
          ) : null}
          {item.hint ? (
            <p className="text-ink-3 mt-3 text-xs leading-relaxed">{item.hint}</p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
