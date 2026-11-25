import { getTranslations } from 'next-intl/server';
import type { PairsTimeline } from '@/features/matching/timeline';
import { cn } from '@/lib/utils';

// Engagement heatmap (Stitch admin "Engagement Heatmap") — committed pairs as
// rows, the cohort's programme months as columns, each cell shaded by that pair's
// session count for the month. Built entirely from real session metadata (counts
// + dates, never content — CLAUDE.md §9.8), scaled against the peak month so the
// shading is meaningful for any cohort.
function initials(name: string | null): string {
  const s = (name ?? '?').trim();
  const [a, b] = s.split(/\s+/).filter(Boolean);
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 0 → empty, then three teal steps up to the peak.
function cellClass(count: number, peak: number): string {
  if (count <= 0) return 'bg-surface-2';
  if (peak <= 1) return 'bg-green';
  const ratio = count / peak;
  if (ratio <= 0.34) return 'bg-green-soft';
  if (ratio <= 0.67) return 'bg-green-light/60';
  return 'bg-green';
}

export async function EngagementHeatmap({ timeline }: { timeline: PairsTimeline }) {
  const t = await getTranslations('dashboardCards');
  const peak = Math.max(1, timeline.peakMonthly);
  const rows = timeline.pairs.slice(0, 8); // keep the card scannable

  return (
    <section className="border-border bg-surface shadow-elevation min-w-0 rounded-lg border p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-h2 text-ink">{t('engagementHeatmap')}</h2>
        <div className="text-micro text-ink-3 flex items-center gap-1.5 tracking-wider uppercase">
          {t('less')}
          <span className="bg-surface-2 size-3 rounded-sm" />
          <span className="bg-green-soft size-3 rounded-sm" />
          <span className="bg-green-light/60 size-3 rounded-sm" />
          <span className="bg-green size-3 rounded-sm" />
          {t('more')}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-small text-ink-3">{t('noEngagementYet')}</p>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table
            data-visualization="engagement"
            className="w-full min-w-[640px] border-separate border-spacing-1"
          >
            <thead>
              <tr>
                <th className="w-40" />
                {timeline.monthStarts.map((m, i) => (
                  <th
                    key={i}
                    className={cn(
                      'text-micro px-1 text-center font-bold tracking-wider uppercase',
                      i === timeline.currentMonthIndex ? 'text-green-strong' : 'text-ink-3',
                    )}
                  >
                    {MONTH[m.getUTCMonth()]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.matchId}>
                  <td className="pr-3">
                    <span className="flex items-center gap-2">
                      <span className="bg-green-soft text-micro text-green-strong flex size-7 shrink-0 items-center justify-center rounded-full font-bold">
                        {initials(p.mentorName)}
                      </span>
                      <span className="text-small text-ink truncate whitespace-nowrap">
                        {p.mentorName} · {p.menteeName}
                      </span>
                    </span>
                  </td>
                  {p.monthly.map((count, i) => (
                    <td key={i} className="p-0">
                      <span
                        title={`${count}`}
                        className={cn(
                          'block h-7 rounded-sm',
                          cellClass(count, peak),
                          i === timeline.currentMonthIndex && 'ring-green-strong/40 ring-1',
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
