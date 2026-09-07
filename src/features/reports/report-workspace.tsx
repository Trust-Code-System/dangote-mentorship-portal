'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import {
  refreshReportForm,
  requestReportPolishForm,
  saveReportContentForm,
  type PolishState,
  type ReportActionState,
  type SaveReportState,
} from './actions';
import { ReportBlocks } from './report-blocks';
import type { ReportContent } from './schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The author's workspace for one report.
//
// The AI pass is explicitly a two-step, human-gated flow (CLAUDE.md §0 rule 5):
// "Format with AI" fetches a *suggestion* and shows it side by side with what is
// saved; nothing is written until the author presses Keep. Declining leaves the
// saved report untouched.
export function ReportWorkspace({
  reportId,
  title,
  saved,
  aiEnabled,
  canEdit,
}: {
  reportId: string;
  title: string;
  saved: ReportContent;
  aiEnabled: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations('reports');
  const tc = useTranslations('common');

  const [reportTitle, setReportTitle] = useState(title);
  // Which polish result the author explicitly declined. Comparing by identity
  // means a *new* suggestion is never pre-dismissed.
  const [dismissed, setDismissed] = useState<PolishState>(null);

  const [polishState, polishAction, polishPending] = useActionState<PolishState, FormData>(
    requestReportPolishForm,
    null,
  );
  const [saveState, saveAction, savePending] = useActionState<SaveReportState, FormData>(
    saveReportContentForm,
    null,
  );
  const [, refreshAction, refreshPending] = useActionState<ReportActionState, FormData>(
    refreshReportForm,
    null,
  );

  // The suggestion is derived, not stored: a server action re-renders this page
  // with fresh `saved` props when it finishes, so once the author keeps the AI
  // version the suggestion equals what is saved and stops being a suggestion.
  // No effects, no cascading renders.
  const proposed = polishState?.ok ? polishState.data.content : null;
  const suggestion =
    proposed && polishState !== dismissed && JSON.stringify(proposed) !== JSON.stringify(saved)
      ? proposed
      : null;

  const shown = suggestion ?? saved;
  const nothingChanged = polishState?.ok && !polishState.data.changed;

  return (
    <div className="space-y-6">
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('workspaceTitle')}</CardTitle>
            <p className="text-small text-ink-2">{t('workspaceHelp')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={saveAction} className="space-y-4">
              <input type="hidden" name="reportId" value={reportId} />
              <input type="hidden" name="content" value={JSON.stringify(shown)} />
              <input
                type="hidden"
                name="aiPolished"
                value={suggestion !== null ? 'true' : 'false'}
              />

              <div className="max-w-xl space-y-1.5">
                <Label htmlFor="report-title">{t('fieldTitle')}</Label>
                <Input
                  id="report-title"
                  name="title"
                  value={reportTitle}
                  onChange={(event) => setReportTitle(event.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={savePending}>
                  {savePending ? tc('loading') : suggestion ? t('keepAiVersion') : tc('save')}
                </Button>

                {suggestion ? (
                  <Button type="button" variant="outline" onClick={() => setDismissed(polishState)}>
                    {t('discardAiVersion')}
                  </Button>
                ) : null}

                {saveState?.ok ? (
                  <span className="text-small text-green-strong" role="status">
                    {t('saved')}
                  </span>
                ) : null}
                {saveState && !saveState.ok ? (
                  <span className="text-small text-risk" role="alert">
                    {saveState.error.message}
                  </span>
                ) : null}
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <form action={polishAction}>
                <input type="hidden" name="reportId" value={reportId} />
                <Button type="submit" variant="outline" disabled={polishPending || !aiEnabled}>
                  <Sparkles className="mr-1.5 size-4" aria-hidden />
                  {polishPending ? t('formatting') : t('formatWithAi')}
                </Button>
              </form>

              <form action={refreshAction}>
                <input type="hidden" name="reportId" value={reportId} />
                <Button type="submit" variant="ghost" disabled={refreshPending}>
                  {refreshPending ? tc('loading') : t('refreshData')}
                </Button>
              </form>

              {!aiEnabled ? <span className="text-small text-ink-3">{t('aiOff')}</span> : null}
              {nothingChanged ? (
                <span className="text-small text-ink-3" role="status">
                  {t('aiNoChanges')}
                </span>
              ) : null}
              {polishState && !polishState.ok ? (
                <span className="text-small text-risk" role="alert">
                  {polishState.error.message}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-h2">{reportTitle}</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reports/${reportId}/export?format=docx`}>{t('downloadWord')}</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reports/${reportId}/export?format=xlsx`}>{t('downloadExcel')}</a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestion ? (
            <p
              className="rounded-md border border-info/40 bg-info/10 px-3 py-2 text-small text-ink"
              role="status"
            >
              {t('aiPreviewNotice')}
            </p>
          ) : null}
          <ReportBlocks content={shown} />
        </CardContent>
      </Card>
    </div>
  );
}
