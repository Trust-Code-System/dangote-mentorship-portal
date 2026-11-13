import { getTranslations } from 'next-intl/server';
import { Lightbulb } from 'lucide-react';

// Weekly tip (experience-layer.md §1.1 / Stitch redesign). Rotates through a small
// bilingual set by ISO week so it changes without any storage. Styled as the
// Stitch "Weekly Tip" recognition card — warm tertiary (gold/brown) surface with
// a lightbulb, the one warm accent in the otherwise teal system.
const TIP_COUNT = 4;

function weekIndex(date: Date, count: number): number {
  const days = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7) % count;
}

export async function WeeklyTip({ className }: { className?: string }) {
  const t = await getTranslations('dashboardCards');
  const i = weekIndex(new Date(), TIP_COUNT) + 1;
  return (
    <div
      className={
        'border-border bg-surface-2/70 text-ink flex h-full flex-col rounded-lg border p-5 ' +
        (className ?? '')
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="size-4" aria-hidden />
        <h3 className="text-small font-semibold">{t('weeklyTip')}</h3>
      </div>
      <p className="text-small text-ink-2 leading-relaxed">{t(`tips.tip${i}`)}</p>
    </div>
  );
}
