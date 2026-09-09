import { getTranslations } from 'next-intl/server';
import { Check, Minus, Users, ClipboardCheck, Flag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { pickLanguageText } from '@/features/cohorts/languages';
import type { FieldAggregate } from './aggregate';
import type { ReviewRollup, ReviewTypeSummary } from './rollup';

type Lang = 'EN' | 'FR';

// Executive review roll-up (CLAUDE.md §5, §12). Renders the pure aggregates from
// rollup.ts: completion tiles, per-question aggregates, the per-pair completion
// matrix, and language participation. Narrative themes (skills, challenges) come
// from the AI Review Assistant; this is the quantitative picture.
export async function ReviewRollupView({
  rollup,
  lang,
}: {
  rollup: ReviewRollup;
  lang: Lang;
}) {
  const t = await getTranslations('reviews');

  return (
    <div className="space-y-8">
      {/* Completion tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={t('eligible')}
          value={rollup.eligibleParticipants}
          hint={t('eligibleHint')}
          icon={<Users className="size-5" />}
        />
        <CompletionTile label={t('midtermCompletion')} summary={rollup.midterm} ofWord={t('ofN')} />
        <CompletionTile label={t('finalCompletion')} summary={rollup.final} ofWord={t('ofN')} />
      </div>

      {/* Per-question roll-up per review */}
      <ReviewSection title={t('midtermTitle')} summary={rollup.midterm} lang={lang} t={t} />
      <ReviewSection title={t('finalTitle')} summary={rollup.final} lang={lang} t={t} />

      {/* Per-pair completion matrix */}
      <section className="space-y-3">
        <h2 className="font-display text-h1 text-ink">{t('perPairTitle')}</h2>
        {rollup.pairs.length === 0 ? (
          <EmptyState title={t('noPairs')} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-2 p-4 text-small">
                <span className="text-micro uppercase text-ink-3">{t('pairColumn')}</span>
                <span className="text-micro uppercase text-ink-3">{t('midtermShort')}</span>
                <span className="text-micro uppercase text-ink-3">{t('finalShort')}</span>
                {rollup.pairs.map((p) => (
                  <PairRow key={p.matchId} pair={p} t={t} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Language + department participation */}
      <section className="space-y-3">
        <h2 className="font-display text-h1 text-ink">{t('participationTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile label="EN" value={rollup.language.en} hint={t('participantsEn')} icon={<Flag className="size-5" />} />
          <StatTile label="FR" value={rollup.language.fr} hint={t('participantsFr')} icon={<Flag className="size-5" />} />
        </div>
        {rollup.departments.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-h3">{t('byDepartment')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {rollup.departments.map((d) => (
                <BarRow
                  key={d.name}
                  label={d.name}
                  count={d.count}
                  total={rollup.eligibleParticipants}
                />
              ))}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

function CompletionTile({
  label,
  summary,
  ofWord,
}: {
  label: string;
  summary: ReviewTypeSummary;
  ofWord: string;
}) {
  const tone = !summary.published
    ? 'default'
    : summary.percent >= 75
      ? 'ok'
      : summary.percent >= 40
        ? 'warn'
        : 'risk';
  return (
    <StatTile
      label={label}
      value={summary.published ? `${summary.percent}%` : '—'}
      hint={summary.published ? `${summary.submitted} ${ofWord} ${summary.eligible}` : undefined}
      tone={tone}
      icon={<ClipboardCheck className="size-5" />}
    />
  );
}

function ReviewSection({
  title,
  summary,
  lang,
  t,
}: {
  title: string;
  summary: ReviewTypeSummary;
  lang: Lang;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-h1 text-ink">{title}</h2>
      {!summary.published ? (
        <EmptyState title={t('notPublishedTitle')} description={t('rollupNotPublished')} />
      ) : summary.submitted === 0 ? (
        <EmptyState title={t('noResponsesTitle')} description={t('noResponsesBody')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summary.aggregates.map((agg) => (
            <AggregateCard key={agg.fieldId} agg={agg} lang={lang} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function AggregateCard({
  agg,
  lang,
  t,
}: {
  agg: FieldAggregate;
  lang: Lang;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const label = pickLanguageText(lang, { EN: agg.labelEn, FR: agg.labelFr });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-small">
        {agg.type === 'rating' ? (
          <div className="space-y-2">
            <p className="text-h2 tabular-nums text-ink">
              {agg.average ?? '—'}
              <span className="text-small text-ink-3"> / {agg.max}</span>
            </p>
            <div className="space-y-1">
              {agg.distribution.map((count, i) => (
                <BarRow
                  key={i}
                  label={String(i + 1)}
                  count={count}
                  total={agg.answered}
                />
              ))}
            </div>
          </div>
        ) : null}

        {agg.type === 'single_select' ? (
          <div className="space-y-1">
            {agg.counts.map((c) => (
              <BarRow
                key={c.value}
                label={pickLanguageText(lang, { EN: c.labelEn, FR: c.labelFr })}
                count={c.count}
                total={agg.answered}
              />
            ))}
          </div>
        ) : null}

        {agg.type === 'boolean' ? (
          <div className="space-y-1">
            <BarRow label={t('yes')} count={agg.yes} total={agg.answered} tone="ok" />
            <BarRow label={t('no')} count={agg.no} total={agg.answered} tone="warn" />
          </div>
        ) : null}

        {agg.type === 'text' ? (
          <p className="text-ink-2">{t('textResponses', { count: agg.answered })}</p>
        ) : null}

        {agg.type !== 'text' ? (
          <p className="text-ink-3">{t('answeredCount', { count: agg.answered })}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BarRow({
  label,
  count,
  total,
  tone = 'green',
}: {
  label: string;
  count: number;
  total: number;
  tone?: 'green' | 'ok' | 'warn' | 'risk';
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate text-ink-2" title={label}>
        {label}
      </span>
      <Progress value={percent} tone={tone} className="flex-1" />
      <span className="w-8 shrink-0 text-right tabular-nums text-ink-2">{count}</span>
    </div>
  );
}

function PairRow({
  pair,
  t,
}: {
  pair: ReviewRollup['pairs'][number];
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <>
      <span className="text-ink">
        {pair.mentorName ?? '—'} <span className="text-ink-3">·</span> {pair.menteeName ?? '—'}
      </span>
      <SubmitCell mentor={pair.mentorMidterm} mentee={pair.menteeMidterm} t={t} />
      <SubmitCell mentor={pair.mentorFinal} mentee={pair.menteeFinal} t={t} />
    </>
  );
}

function SubmitCell({
  mentor,
  mentee,
  t,
}: {
  mentor: boolean;
  mentee: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <span className="flex items-center gap-2" aria-label={`${t('mentorShort')} ${mentor ? '✓' : '—'}, ${t('menteeShort')} ${mentee ? '✓' : '—'}`}>
      <Mark on={mentor} title={t('mentorShort')} />
      <Mark on={mentee} title={t('menteeShort')} />
    </span>
  );
}

function Mark({ on, title }: { on: boolean; title: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-full',
        on ? 'bg-green-soft text-green-strong' : 'bg-surface-2 text-ink-3',
      )}
    >
      {on ? <Check className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
    </span>
  );
}
