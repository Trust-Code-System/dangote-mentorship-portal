'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { NewsletterStatus } from '@prisma/client';
import {
  approveNewsletterForm,
  requestNewsletterDraftForm,
  saveNewsletterForm,
  sendNewsletterNowForm,
  unapproveNewsletterForm,
  type ApproveState,
  type DraftState,
  type NewsletterActionState,
  type SaveNewsletterState,
  type SendState,
} from './actions';
import {
  defaultHeadingFor,
  sendableSections,
  type NewsletterBody,
  type NewsletterSectionKind,
} from './schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// The newsletter composer. Pre-arranged sections in a fixed order, each
// bilingual, so an issue takes minutes rather than a blank-page effort.
//
// Sending is a two-step human gate (CLAUDE.md §16): Approve records who signed
// off, and only then does Send (or the hourly dispatcher) do anything. Editing
// an approved issue withdraws the approval server-side, so nothing can go out
// that a person did not see in its final form.
export function NewsletterComposer({
  newsletterId,
  cohortName,
  status,
  initialTitle,
  initialSubjectEn,
  initialSubjectFr,
  initialBody,
  recipientCount,
  approvedByName,
  aiEnabled,
  sentCount,
}: {
  newsletterId: string;
  cohortName: string;
  status: NewsletterStatus;
  initialTitle: string;
  initialSubjectEn: string;
  initialSubjectFr: string;
  initialBody: NewsletterBody;
  recipientCount: number;
  approvedByName: string | null;
  aiEnabled: boolean;
  sentCount: number;
}) {
  const t = useTranslations('newsletters');
  const tc = useTranslations('common');

  const [title, setTitle] = useState(initialTitle);
  const [subjectEn, setSubjectEn] = useState(initialSubjectEn);
  const [subjectFr, setSubjectFr] = useState(initialSubjectFr);
  const [body, setBody] = useState<NewsletterBody>(initialBody);
  const [usedAiDraft, setUsedAiDraft] = useState(false);
  const [sendAt, setSendAt] = useState('');

  const [draftState, draftAction, draftPending] = useActionState<DraftState, FormData>(
    requestNewsletterDraftForm,
    null,
  );
  const [saveState, saveAction, savePending] = useActionState<SaveNewsletterState, FormData>(
    saveNewsletterForm,
    null,
  );
  const [approveState, approveAction, approvePending] = useActionState<ApproveState, FormData>(
    approveNewsletterForm,
    null,
  );
  const [, unapproveAction, unapprovePending] = useActionState<NewsletterActionState, FormData>(
    unapproveNewsletterForm,
    null,
  );
  const [sendState, sendAction, sendPending] = useActionState<SendState, FormData>(
    sendNewsletterNowForm,
    null,
  );

  const isSent = status === NewsletterStatus.SENT;
  const isApproved = status === NewsletterStatus.SCHEDULED;
  const readyCount = sendableSections(body).length;

  /** Pull the AI suggestion into the editor. Still unsaved at this point. */
  function applyDraft() {
    if (!draftState?.ok) return;
    setBody(draftState.data.body);
    if (draftState.data.subjectEn) setSubjectEn(draftState.data.subjectEn);
    if (draftState.data.subjectFr) setSubjectFr(draftState.data.subjectFr);
    setUsedAiDraft(true);
  }

  function updateSection(index: number, patch: Partial<NewsletterBody['sections'][number]>) {
    setBody((current) => ({
      sections: current.sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isSent ? 'ok' : isApproved ? 'warn' : 'neutral'}>
          {t(`status${status}`)}
        </Badge>
        <span className="text-small text-ink-2">
          {t('goesTo', { count: recipientCount, cohort: cohortName })}
        </span>
        {approvedByName ? (
          <span className="text-small text-ink-3">
            {t('approvedBy', { name: approvedByName })}
          </span>
        ) : null}
        {isSent ? (
          <span className="text-small text-green-strong">{t('sentTo', { count: sentCount })}</span>
        ) : null}
      </div>

      {!isSent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('assistantTitle')}</CardTitle>
            <p className="text-small text-ink-2">{t('assistantHelp')}</p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <form action={draftAction}>
              <input type="hidden" name="newsletterId" value={newsletterId} />
              <Button type="submit" variant="outline" disabled={draftPending || !aiEnabled}>
                <Sparkles className="mr-1.5 size-4" aria-hidden />
                {draftPending ? t('drafting') : t('draftWithAi')}
              </Button>
            </form>

            {draftState?.ok ? (
              <Button type="button" onClick={applyDraft}>
                {t('useDraft')}
              </Button>
            ) : null}

            {!aiEnabled ? <span className="text-small text-ink-3">{t('aiOff')}</span> : null}
            {draftState?.ok ? (
              <span className="text-small text-ink-2" role="status">
                {t('draftReady')}
              </span>
            ) : null}
            {draftState && !draftState.ok ? (
              <span className="text-small text-risk" role="alert">
                {draftState.error.message}
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <form action={saveAction} className="space-y-6">
        <input type="hidden" name="newsletterId" value={newsletterId} />
        <input type="hidden" name="body" value={JSON.stringify(body)} />
        <input type="hidden" name="aiDrafted" value={usedAiDraft ? 'true' : 'false'} />

        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('issueTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">{t('fieldTitle')}</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                disabled={isSent}
                required
              />
              <p className="text-small text-ink-3">{t('fieldTitleHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subjectEn">{t('fieldSubjectEn')}</Label>
              <Input
                id="subjectEn"
                name="subjectEn"
                value={subjectEn}
                onChange={(event) => setSubjectEn(event.target.value)}
                maxLength={200}
                disabled={isSent}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subjectFr">{t('fieldSubjectFr')}</Label>
              <Input
                id="subjectFr"
                name="subjectFr"
                value={subjectFr}
                onChange={(event) => setSubjectFr(event.target.value)}
                maxLength={200}
                disabled={isSent}
                required
              />
            </div>
          </CardContent>
        </Card>

        {body.sections.map((section, index) => (
          <Card key={section.kind}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-h3">{t(sectionKey(section.kind))}</CardTitle>
              <label className="flex items-center gap-2 text-small text-ink-2">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(event) => updateSection(index, { enabled: event.target.checked })}
                  disabled={isSent}
                  className="size-4 rounded border-border text-green focus:ring-green/30"
                />
                {t('includeSection')}
              </label>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`headingEn-${section.kind}`}>{t('headingEn')}</Label>
                  <Input
                    id={`headingEn-${section.kind}`}
                    value={section.headingEn}
                    onChange={(event) => updateSection(index, { headingEn: event.target.value })}
                    placeholder={defaultHeadingFor(section.kind, 'EN')}
                    maxLength={160}
                    disabled={isSent}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`bodyEn-${section.kind}`}>{t('bodyEn')}</Label>
                  <Textarea
                    id={`bodyEn-${section.kind}`}
                    value={section.bodyEn}
                    onChange={(event) => updateSection(index, { bodyEn: event.target.value })}
                    rows={4}
                    maxLength={4000}
                    disabled={isSent}
                    placeholder={t(hintKey(section.kind))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`headingFr-${section.kind}`}>{t('headingFr')}</Label>
                  <Input
                    id={`headingFr-${section.kind}`}
                    value={section.headingFr}
                    onChange={(event) => updateSection(index, { headingFr: event.target.value })}
                    placeholder={defaultHeadingFor(section.kind, 'FR')}
                    maxLength={160}
                    disabled={isSent}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`bodyFr-${section.kind}`}>{t('bodyFr')}</Label>
                  <Textarea
                    id={`bodyFr-${section.kind}`}
                    value={section.bodyFr}
                    onChange={(event) => updateSection(index, { bodyFr: event.target.value })}
                    rows={4}
                    maxLength={4000}
                    disabled={isSent}
                    placeholder={t(hintKey(section.kind))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!isSent ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={savePending}>
              {savePending ? tc('loading') : tc('save')}
            </Button>
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
            <span className="text-small text-ink-3">
              {t('sectionsReady', { count: readyCount })}
            </span>
          </div>
        ) : null}
      </form>

      {!isSent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t('approveTitle')}</CardTitle>
            <p className="text-small text-ink-2">{t('approveHelp')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isApproved ? (
              <form action={approveAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="newsletterId" value={newsletterId} />
                <div className="space-y-1.5">
                  <Label htmlFor="sendAt">{t('fieldSendAt')}</Label>
                  <Input
                    id="sendAt"
                    name="sendAt"
                    type="datetime-local"
                    value={sendAt}
                    onChange={(event) => setSendAt(event.target.value)}
                    className="w-60"
                  />
                  <p className="text-small text-ink-3">{t('fieldSendAtHint')}</p>
                </div>
                <Button type="submit" disabled={approvePending}>
                  {approvePending ? tc('loading') : t('approve')}
                </Button>
                {approveState && !approveState.ok ? (
                  <p className="text-small text-risk" role="alert">
                    {approveState.error.message}
                  </p>
                ) : null}
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <form action={sendAction}>
                  <input type="hidden" name="newsletterId" value={newsletterId} />
                  <Button type="submit" disabled={sendPending}>
                    {sendPending ? t('sending') : t('sendNow', { count: recipientCount })}
                  </Button>
                </form>
                <form action={unapproveAction}>
                  <input type="hidden" name="newsletterId" value={newsletterId} />
                  <Button type="submit" variant="outline" disabled={unapprovePending}>
                    {t('backToDraft')}
                  </Button>
                </form>
                {sendState?.ok ? (
                  <span className="text-small text-green-strong" role="status">
                    {t('sendResult', {
                      sent: sendState.data.sent,
                      failed: sendState.data.failed,
                    })}
                  </span>
                ) : null}
                {sendState && !sendState.ok ? (
                  <span className="text-small text-risk" role="alert">
                    {sendState.error.message}
                  </span>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function sectionKey(kind: NewsletterSectionKind): string {
  return `section_${kind}`;
}

function hintKey(kind: NewsletterSectionKind): string {
  return `hint_${kind}`;
}
