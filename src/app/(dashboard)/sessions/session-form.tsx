'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MeetingType } from '@prisma/client';
import { saveSessionLog, requestSessionAssistant } from '@/features/sessions/actions';
import type { SessionSummaryOutcome } from '@/features/sessions/summary';
import { useOfflineForm } from '@/components/use-offline-form';
import { AIContainer } from '@/components/ai-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Radix Select has no empty-value item; "no meeting type" rides a sentinel while
// the form state keeps '' so the submitted FormData stays unchanged.
const NO_TYPE = '__none__';

type Assignee = 'mentee' | 'mentor' | 'none';
interface ItemRow {
  task: string;
  assignee: Assignee;
  due: string;
}
interface Values {
  // Index signature lets this satisfy useOfflineForm's Record<string, unknown>
  // constraint while keeping each field's explicit type below.
  [key: string]: unknown;
  roughNotes: string;
  date: string;
  time: string;
  meetingType: string;
  competencyDiscussed: string;
  goalDiscussed: string;
  discussionSummary: string;
  actionsAgreed: string;
  challenges: string;
  resourcesNeeded: string;
  nextActionPlan: string;
  timeline: string;
  nextMeetingDate: string;
  aiSummary: string;
  actionItems: ItemRow[];
}

const MEETING_TYPES = Object.values(MeetingType);

export function SessionForm({
  menteeId,
  cohortId,
  mentorName,
}: {
  menteeId: string;
  cohortId: string;
  mentorName: string | null;
}) {
  const t = useTranslations('sessions');
  const tc = useTranslations('common');
  const router = useRouter();

  const initial: Values = {
    roughNotes: '',
    date: new Date().toISOString().slice(0, 10),
    time: '',
    meetingType: '',
    competencyDiscussed: '',
    goalDiscussed: '',
    discussionSummary: '',
    actionsAgreed: '',
    challenges: '',
    resourcesNeeded: '',
    nextActionPlan: '',
    timeline: '',
    nextMeetingDate: '',
    aiSummary: '',
    actionItems: [],
  };

  const form = useOfflineForm<Values>({
    storageKey: `session-log:mentee:v2:${menteeId}:${cohortId}`,
    initial,
    onSubmit: async (v) => {
      const fd = new FormData();
      fd.set('date', v.date);
      fd.set('time', v.time);
      if (v.meetingType) fd.set('meetingType', v.meetingType);
      fd.set('competencyDiscussed', v.competencyDiscussed);
      fd.set('goalDiscussed', v.goalDiscussed);
      fd.set('discussionSummary', v.discussionSummary);
      fd.set('actionsAgreed', v.actionsAgreed);
      fd.set('challenges', v.challenges);
      fd.set('resourcesNeeded', v.resourcesNeeded);
      fd.set('nextActionPlan', v.nextActionPlan);
      fd.set('timeline', v.timeline);
      fd.set('nextMeetingDate', v.nextMeetingDate);
      fd.set('aiSummary', v.aiSummary);
      fd.set('actionItems', JSON.stringify(v.actionItems.filter((i) => i.task.trim())));
      const res = await saveSessionLog(fd);
      return { ok: res.ok };
    },
    onSuccess: () => {
      form.replace({ ...initial });
      router.refresh();
    },
  });

  const { values: v, update } = form;
  const [aiPending, startAi] = useTransition();
  const [ai, setAi] = useState<SessionSummaryOutcome | null>(null);

  // Completion meter (Stitch session-log header) — share of the key fields that
  // carry content, so it's a real progress indicator, not a placeholder.
  const completionFields = [
    v.date,
    v.time,
    v.meetingType,
    v.competencyDiscussed,
    v.goalDiscussed,
    v.discussionSummary,
    v.actionsAgreed,
    v.challenges,
    v.nextActionPlan,
    v.nextMeetingDate,
  ];
  const completionPct = Math.round(
    (completionFields.filter((f) => String(f).trim().length > 0).length / completionFields.length) *
      100,
  );

  function runAssistant() {
    if (!v.roughNotes.trim()) return;
    setAi(null);
    startAi(async () => {
      const res = await requestSessionAssistant({ notes: v.roughNotes });
      if (res.ok) {
        setAi(res.data);
        const r = res.data.result;
        if (r) {
          update({
            discussionSummary: r.summary || v.discussionSummary,
            aiSummary: r.summary || v.aiSummary,
            competencyDiscussed: r.competencyDiscussed || v.competencyDiscussed,
            challenges: r.challenges || v.challenges,
            nextActionPlan: r.nextSteps || v.nextActionPlan,
            timeline: r.timeline || v.timeline,
            actionItems: [
              ...v.actionItems,
              ...r.actionItems.map((a) => ({
                task: a.task,
                assignee: 'mentee' as Assignee,
                due: a.due && /^\d{4}-\d{2}-\d{2}/.test(a.due) ? a.due.slice(0, 10) : '',
              })),
            ],
          });
        }
      }
    });
  }

  function setItem(i: number, patch: Partial<ItemRow>) {
    update({ actionItems: v.actionItems.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function addItem() {
    update({ actionItems: [...v.actionItems, { task: '', assignee: 'mentee', due: '' }] });
  }
  function removeItem(i: number) {
    update({ actionItems: v.actionItems.filter((_, idx) => idx !== i) });
  }

  const statusText: Record<string, string> = {
    idle: '',
    savedLocally: t('savedLocally'),
    syncing: t('syncing'),
    synced: t('synced'),
    offline: t('offlineQueued'),
    error: tc('errorBody'),
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.submit();
      }}
      className="space-y-4"
    >
      {/* Completion meter (Stitch session-log header) */}
      <div className="border-border bg-surface-2/60 rounded-lg border p-4">
        <div className="text-micro flex items-center justify-between font-bold tracking-wider uppercase">
          <span className="text-ink-2">{t('loggingSession')}</span>
          <span className="text-green-strong tabular-nums">
            {completionPct}% {t('complete')}
          </span>
        </div>
        <div className="bg-surface-2 mt-2 h-2 overflow-hidden rounded-full">
          <div
            className="from-green-light to-green h-full rounded-full bg-gradient-to-r transition-[width] duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* The mentee's mentor is determined by the accepted pairing. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="sf-mentor">{t('mentor')}</Label>
          <Input id="sf-mentor" value={mentorName ?? '—'} readOnly />
        </div>
        <div className="hidden space-y-1 sm:block">
          <Label htmlFor="sf-type">{t('meetingType')}</Label>
          <Select
            value={v.meetingType || NO_TYPE}
            onValueChange={(val) => update({ meetingType: val === NO_TYPE ? '' : val })}
          >
            <SelectTrigger id="sf-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TYPE}>—</SelectItem>
              {MEETING_TYPES.map((mt) => (
                <SelectItem key={mt} value={mt}>
                  {t(`type.${mt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FieldInput
          id="sf-date"
          label={t('date')}
          type="date"
          value={v.date}
          onChange={(val) => update({ date: val })}
        />
        <div className="hidden sm:block">
          <FieldInput
            id="sf-time"
            label={t('time')}
            value={v.time}
            onChange={(val) => update({ time: val })}
          />
        </div>
        <FieldInput
          id="sf-comp"
          label={t('competencyDiscussed')}
          value={v.competencyDiscussed}
          onChange={(val) => update({ competencyDiscussed: val })}
        />
      </div>

      {/* Rough notes → AI (§7 AI surface): rough notes in, structured editable
          fields out. */}
      <AIContainer
        title={t('summarize')}
        actions={
          <Button
            type="button"
            size="sm"
            onClick={runAssistant}
            disabled={aiPending || !v.roughNotes.trim()}
          >
            {aiPending ? t('summarizing') : t('summarize')}
          </Button>
        }
      >
        <Label htmlFor="sf-rough" className="sr-only">
          {t('roughNotes')}
        </Label>
        <Textarea
          id="sf-rough"
          value={v.roughNotes}
          onChange={(e) => update({ roughNotes: e.target.value })}
          placeholder={t('roughNotesHint')}
          rows={3}
          className="bg-bg"
        />
        <p className="text-small text-ink-2 mt-2">{t('assistantHint')}</p>
        {ai && !ai.result ? (
          <p className="text-small text-ink-2 mt-1">
            {ai.aiEnabled ? t('assistantNoResult') : t('assistantUnavailable')}
          </p>
        ) : null}
        {ai?.result?.riskFlag ? (
          <p className="text-small text-risk mt-1">{t('riskFlagged')}</p>
        ) : null}
        {ai?.result?.suggestedAgenda ? (
          <p className="text-small mt-1">
            <strong>{t('suggestedAgenda')}:</strong> {ai.result.suggestedAgenda}
          </p>
        ) : null}
      </AIContainer>

      {/* Structured fields stay available without overwhelming the mobile logging flow. */}
      <details className="border-border bg-surface rounded-md border px-4 py-3">
        <summary className="text-small text-green-strong cursor-pointer font-semibold">
          Additional session details
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldInput
              id="sf-goal"
              label={t('goalDiscussed')}
              value={v.goalDiscussed}
              onChange={(val) => update({ goalDiscussed: val })}
            />
          </div>
          <FieldText
            id="sf-summary"
            label={t('discussionSummary')}
            value={v.discussionSummary}
            onChange={(val) => update({ discussionSummary: val })}
          />
          <FieldText
            id="sf-actions"
            label={t('actionsAgreed')}
            value={v.actionsAgreed}
            onChange={(val) => update({ actionsAgreed: val })}
          />
          <FieldText
            id="sf-challenges"
            label={t('challenges')}
            value={v.challenges}
            onChange={(val) => update({ challenges: val })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldInput
              id="sf-resources"
              label={t('resourcesNeeded')}
              value={v.resourcesNeeded}
              onChange={(val) => update({ resourcesNeeded: val })}
            />
            <FieldInput
              id="sf-timeline"
              label={t('timeline')}
              value={v.timeline}
              onChange={(val) => update({ timeline: val })}
            />
          </div>
          <FieldText
            id="sf-next"
            label={t('nextActionPlan')}
            value={v.nextActionPlan}
            onChange={(val) => update({ nextActionPlan: val })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldInput
              id="sf-nextdate"
              label={t('nextMeetingDate')}
              type="date"
              value={v.nextMeetingDate}
              onChange={(val) => update({ nextMeetingDate: val })}
            />
          </div>

          {/* Action items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('actionItems')}</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addItem}>
                {t('addActionItem')}
              </Button>
            </div>
            {v.actionItems.length === 0 ? (
              <p className="text-small text-ink-2">{t('noActionItemsYet')}</p>
            ) : (
              <div className="space-y-2">
                {v.actionItems.map((item, i) => (
                  <div
                    key={i}
                    className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                  >
                    <Input
                      value={item.task}
                      onChange={(e) => setItem(i, { task: e.target.value })}
                      placeholder={t('taskPlaceholder')}
                      aria-label={t('task')}
                    />
                    <Select
                      value={item.assignee}
                      onValueChange={(val) => setItem(i, { assignee: val as Assignee })}
                    >
                      <SelectTrigger aria-label={t('owner')} className="w-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mentee">{t('owner_mentee')}</SelectItem>
                        <SelectItem value="mentor">{t('owner_mentor')}</SelectItem>
                        <SelectItem value="none">{t('owner_none')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={item.due}
                      onChange={(e) => setItem(i, { due: e.target.value })}
                      aria-label={t('dueDate')}
                      className="w-auto"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(i)}
                      aria-label={tc('delete')}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline">
          Save draft
        </Button>
        <Button type="submit" disabled={form.status === 'syncing'}>
          {form.status === 'syncing' ? tc('loading') : t('saveLog')}
        </Button>
        {!form.online ? <span className="text-small text-warn">{t('offline')}</span> : null}
        {statusText[form.status] ? (
          <span className="text-small text-ink-2">{statusText[form.status]}</span>
        ) : null}
      </div>
    </form>
  );
}

function FieldInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldText({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
