import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ImportRowStatus, ImportStatus } from '@prisma/client';
import { AlertTriangle, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { commitImportForm, setImportRowStatusForm } from '@/features/imports/actions';
import { cleanRow, hasBlockingErrors, type Finding } from '@/features/imports/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/ui/stat-tile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

function WorkflowProgress({ committed, labels }: { committed: boolean; labels: string[] }) {
  const currentIndex = committed ? 4 : 3;
  return (
    <div className="relative rounded-lg border border-border bg-surface p-5 shadow-elevation">
      <div className="absolute left-10 right-10 top-[2.35rem] h-0.5 bg-surface-2" />
      <div className="absolute left-10 top-[2.35rem] h-0.5 rounded-full bg-green" style={{ width: `calc((100% - 5rem) * ${currentIndex / 4})` }} />
      <ol className="relative flex justify-between">
        {labels.map((label, index) => (
          <li key={label} className="flex w-20 flex-col items-center gap-1.5 text-center">
            <span className={cn('grid size-8 place-items-center rounded-full border-2 bg-surface text-micro font-bold', index < currentIndex ? 'border-green bg-green text-white' : index === currentIndex ? 'border-green text-green' : 'border-border text-ink-3')}>
              {index < currentIndex ? <Check className="size-4" /> : index + 1}
            </span>
            <span className="text-micro uppercase text-ink-3">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('imports');
  const imported = await prisma.import.findUnique({
    where: { id },
    include: { cohort: { select: { name: true } }, rows: { where: { deletedAt: null }, orderBy: { rowNumber: 'asc' } } },
  });
  if (!imported || imported.deletedAt) notFound();

  const committed = imported.status === ImportStatus.COMMITTED;
  const total = imported.rows.length;
  const flagged = imported.rows.filter((row) => hasBlockingErrors((row.validation ?? []) as unknown as Finding[]) || row.status === ImportRowStatus.FLAGGED).length;
  const valid = total - flagged;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-micro text-ink-3">{t('breadcrumb')}</p>
          <h1 className="mt-1 font-display text-h1 font-bold text-ink">{t('reviewTitle')}</h1>
          <p className="text-small text-ink-2">{t('reviewSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">{t('exportCsv')}</Button>
          {committed ? <Badge>{t('committed')}</Badge> : (
            <form action={commitImportForm}><input type="hidden" name="importId" value={imported.id} /><Button size="sm" type="submit">{t('commit')}</Button></form>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('totalRows')} value={total} />
        <StatTile label={t('valid')} value={valid} tone="ok" />
        <StatTile label={t('flaggedCount')} value={flagged} tone={flagged ? 'risk' : 'default'} />
        <StatTile label={t('systemHealth')} value={flagged ? t('reviewNeeded') : t('optimized')} tone={flagged ? 'info' : 'ok'} valueClassName="text-h3" />
      </div>

      <WorkflowProgress committed={committed} labels={[t('stepUpload'), t('stepMapping'), t('stepValidation'), t('stepReview'), t('stepCommit')]} />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_270px]">
        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-elevation">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-h3">{t('importedRecords')}</h2><span className="text-micro text-ink-3">{imported.fileName}</span></div>
          <Table>
            <TableHeader><TableRow><TableHead>{t('statusLabel')}</TableHead><TableHead>{t('fullName')}</TableHead><TableHead>{t('role')}</TableHead><TableHead>{t('email')}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {imported.rows.map((row) => {
                const findings = (row.validation ?? []) as unknown as Finding[];
                const clean = cleanRow(row.raw as Record<string, unknown>);
                const blocked = hasBlockingErrors(findings);
                return (
                  <TableRow key={row.id}>
                    <TableCell><span className={cn('inline-flex size-7 items-center justify-center rounded-full', blocked ? 'bg-risk/10 text-risk' : findings.length ? 'bg-warn/10 text-warn' : 'bg-green-soft text-green-strong')}>{blocked ? <AlertTriangle className="size-3.5" /> : <Check className="size-3.5" />}</span></TableCell>
                    <TableCell className="font-medium">{clean.fullName || '—'}</TableCell>
                    <TableCell><Badge variant="neutral">{t(imported.targetRole === 'MENTOR' ? 'mentorRole' : 'menteeRole')}</Badge></TableCell>
                    <TableCell className="text-small text-ink-2">{clean.email || '—'}</TableCell>
                    <TableCell>
                      {!committed ? <div className="flex justify-end gap-1">
                        <form action={setImportRowStatusForm}><input type="hidden" name="rowId" value={row.id} /><input type="hidden" name="status" value={ImportRowStatus.ACCEPTED} /><Button type="submit" size="sm" variant="ghost" disabled={blocked}>{t('accept')}</Button></form>
                        <form action={setImportRowStatusForm}><input type="hidden" name="rowId" value={row.id} /><input type="hidden" name="status" value={ImportRowStatus.REJECTED} /><Button type="submit" size="sm" variant="ghost">{t('reject')}</Button></form>
                      </div> : <Badge variant="neutral">{t(`rowStatus.${row.status}`)}</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        <aside className="rounded-lg border border-info/20 bg-info/[0.07] p-5 shadow-elevation">
          <p className="flex items-center gap-2 text-small font-bold text-info"><Sparkles className="size-4" /> {t('assistant')}</p>
          <p className="mt-3 text-small text-ink-2">{t('validationSummary', { count: flagged })}</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-surface p-3"><p className="text-micro font-bold uppercase text-ink-3">{t('criticalInsight')}</p><p className="mt-1 text-small text-ink-2">{flagged ? t('resolveBlocking') : t('readyForReview')}</p></div>
            <div className="rounded-md bg-surface p-3"><p className="text-micro font-bold uppercase text-ink-3">{t('systemStatus')}</p><p className="mt-1 flex items-center gap-2 text-small text-green-strong"><ShieldCheck className="size-4" /> {t('validationComplete')}</p></div>
          </div>
          <Button variant="outline" className="mt-4 w-full border-info/30 text-info">{t('generateAuditReport')}</Button>
        </aside>
      </div>
    </section>
  );
}
