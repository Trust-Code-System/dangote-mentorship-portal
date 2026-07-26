'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { saveGoalForm, requestGoalCoach, type GoalActionState } from '@/features/goals/actions';
import type { CoachResult } from '@/features/goals/coach';
import type { GoalDraftFields, SmartDimension } from '@/features/goals/smart';
import { useFormDraft } from '@/components/use-form-draft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// SMART step rail (Stitch "Create SMART Goal" header). The five dimensions light
// up green as the matching fields are filled, so it's a real progress indicator —
// not a decorative stepper.
const SMART_STEPS: { key: SmartDimension; field: keyof Values | (keyof Values)[] }[] = [
  { key: 'specific', field: ['title', 'competency'] },
  { key: 'measurable', field: 'successMeasure' },
  { key: 'achievable', field: 'learningActivity' },
  { key: 'relevant', field: 'whyMatters' },
  { key: 'timeBound', field: 'endDate' },
];

function SmartRail({ values, labelFor }: { values: Values; labelFor: (d: SmartDimension) => string }) {
  const done = (f: keyof Values | (keyof Values)[]) =>
    (Array.isArray(f) ? f : [f]).every((k) => values[k].trim().length > 0);
  const filledCount = SMART_STEPS.filter((s) => done(s.field)).length;
  const currentIndex = SMART_STEPS.findIndex((s) => !done(s.field));

  return (
    <div className="relative py-2">
      <div className="absolute left-4 right-4 top-[1.35rem] h-0.5 bg-surface-2" aria-hidden />
      <div
        className="absolute left-4 top-[1.35rem] h-0.5 rounded-full bg-green transition-[width] duration-500"
        style={{ width: `calc((100% - 2rem) * ${SMART_STEPS.length > 1 ? filledCount / (SMART_STEPS.length - 1) : 0})` }}
        aria-hidden
      />
      <ol className="relative flex justify-between">
        {SMART_STEPS.map((s, i) => {
          const isDone = done(s.field);
          const isCurrent = i === currentIndex;
          return (
            <li key={s.key} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border-2 bg-surface text-small font-bold transition-colors',
                  isDone
                    ? 'border-green bg-green text-white'
                    : isCurrent
                      ? 'border-green text-green'
                      : 'border-border text-ink-3',
                )}
              >
                {isDone ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-micro uppercase tracking-wider',
                  isDone || isCurrent ? 'font-bold text-green-strong' : 'text-ink-3',
                )}
              >
                {labelFor(s.key)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type Values = Required<{ [K in keyof GoalDraftFields]: string }>;

const EMPTY: Values = {
  title: '',
  competency: '',
  whyMatters: '',
  currentLevel: '',
  desiredLevel: '',
  learningActivity: '',
  successMeasure: '',
  startDate: '',
  endDate: '',
};

// Mentee goal form (CLAUDE.md §7). Autosaves a draft so work is never lost
// (experience-layer.md §1.11), and offers the Goal Coach (§9.2) as an editable
// suggestion — the mentee always stays in control of what is saved.
export function GoalForm({
  mode,
  goalId,
  cohortId,
  initial,
  enableDraft = false,
}: {
  mode: 'create' | 'edit';
  goalId?: string;
  cohortId?: string;
  initial?: GoalDraftFields;
  enableDraft?: boolean;
}) {
  const t = useTranslations('goals');
  const tc = useTranslations('common');
  const td = useTranslations('drafts');
  const router = useRouter();

  const [values, setValues] = useState<Values>({ ...EMPTY, ...normalize(initial) });
  const [activeStep, setActiveStep] = useState(0);
  const [state, action, pending] = useActionState<GoalActionState, FormData>(saveGoalForm, null);

  const formKey = mode === 'edit' && goalId ? `goal:${goalId}` : 'goal:new';
  const { status: draftStatus, clear } = useFormDraft({
    formKey,
    values,
    cohortId,
    enabled: enableDraft,
  });

  const [coachPending, startCoach] = useTransition();
  const [coach, setCoach] = useState<CoachResult | null>(null);

  // On a successful save, clear the draft and refresh server data so the new or
  // updated goal appears in the list.
  useEffect(() => {
    if (!state?.ok) return;
    if (enableDraft) void clear();
    router.refresh();
    if (mode !== 'create') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setValues({ ...EMPTY });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function set<K extends keyof Values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function runCoach() {
    setCoach(null);
    startCoach(async () => {
      const res = await requestGoalCoach(values);
      if (res.ok) setCoach(res.data);
    });
  }

  function applySuggestion() {
    const s = coach?.suggestion;
    if (!s) return;
    setValues((v) => ({
      ...v,
      title: s.title || v.title,
      successMeasure: s.successMeasure || v.successMeasure,
      learningActivity: s.learningActivity || v.learningActivity,
    }));
  }

  return (
    <form action={action} className="space-y-5">
      {goalId ? <input type="hidden" name="goalId" value={goalId} /> : null}
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {/* SMART step rail — lights up as fields are completed */}
      <SmartRail values={values} labelFor={(d) => t(`smart.${d}`)} />

      {enableDraft && draftStatus === 'saved' ? (
        <p className="text-xs text-ink-3">{td('saved')}</p>
      ) : null}

      {activeStep === 0 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor={`${formKey}-title`}>{t('titleField')}</Label>
            <Input id={`${formKey}-title`} required minLength={3} maxLength={200} value={values.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <Field id={`${formKey}-competency`} label={t('competency')} name="competencyVisible" value={values.competency} onChange={(v) => set('competency', v)} />
        </div>
      ) : null}
      {activeStep === 1 ? (
        <TextField id={`${formKey}-successMeasure`} label={t('successMeasure')} name="successMeasureVisible" value={values.successMeasure} onChange={(v) => set('successMeasure', v)} />
      ) : null}
      {activeStep === 2 ? (
        <div className="space-y-4">
          <TextField id={`${formKey}-learningActivity`} label={t('learningActivity')} name="learningActivityVisible" value={values.learningActivity} onChange={(v) => set('learningActivity', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${formKey}-currentLevel`} label={t('currentLevel')} name="currentLevelVisible" value={values.currentLevel} onChange={(v) => set('currentLevel', v)} />
            <Field id={`${formKey}-desiredLevel`} label={t('desiredLevel')} name="desiredLevelVisible" value={values.desiredLevel} onChange={(v) => set('desiredLevel', v)} />
          </div>
        </div>
      ) : null}
      {activeStep === 3 ? (
        <TextField id={`${formKey}-whyMatters`} label={t('whyMatters')} name="whyMattersVisible" value={values.whyMatters} onChange={(v) => set('whyMatters', v)} />
      ) : null}
      {activeStep === 4 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${formKey}-startDate`} label={t('startDate')} name="startDateVisible" type="date" value={values.startDate} onChange={(v) => set('startDate', v)} />
          <Field id={`${formKey}-endDate`} label={t('endDate')} name="endDateVisible" type="date" value={values.endDate} onChange={(v) => set('endDate', v)} />
        </div>
      ) : null}

      {/* Goal Coach — advisory; suggestion is editable before anything saves.
          Indigo AI container (Stitch "AI Suggested Metrics"). */}
      {activeStep === 1 ? <div className="space-y-2 rounded-md border border-dashed border-info/40 bg-info/[0.07] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-h3 text-info">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-info/15">
              <Sparkles className="size-3.5" />
            </span>
            {t('coachTitle')}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={runCoach} disabled={coachPending || !values.title.trim()}>
            {coachPending ? t('coaching') : t('askCoach')}
          </Button>
        </div>
        <p className="text-small text-ink-2">{t('coachIntro')}</p>

        {coach ? (
          <div className="space-y-2 text-small">
            <p className="text-ink">
              {t('smartScore')}: <span className="font-bold text-info">{coach.assessment.score}%</span>
            </p>
            {coach.assessment.missing.length > 0 ? (
              <p className="text-ink-2">
                {t('coachMissing')}:{' '}
                {coach.assessment.missing.map((d: SmartDimension) => t(`smart.${d}`)).join(', ')}
              </p>
            ) : null}

            {coach.suggestion ? (
              <div className="space-y-1 rounded-md border border-info/20 bg-surface p-3">
                {coach.suggestion.rationale ? (
                  <p className="text-small italic text-ink-2">{coach.suggestion.rationale}</p>
                ) : null}
                {coach.suggestion.title ? <p className="text-ink"><strong>{t('titleField')}:</strong> {coach.suggestion.title}</p> : null}
                {coach.suggestion.successMeasure ? <p className="text-ink"><strong>{t('successMeasure')}:</strong> {coach.suggestion.successMeasure}</p> : null}
                {coach.suggestion.learningActivity ? <p className="text-ink"><strong>{t('learningActivity')}:</strong> {coach.suggestion.learningActivity}</p> : null}
                <Button type="button" size="sm" variant="secondary" onClick={applySuggestion}>
                  {t('applySuggestion')}
                </Button>
              </div>
            ) : (
              <p className="text-small text-ink-2">
                {coach.aiEnabled ? t('coachNoSuggestion') : t('coachUnavailable')}
              </p>
            )}
          </div>
        ) : null}
      </div> : null}

      {state && !state.ok ? (
        <p className="text-sm text-destructive">
          {state.error.code === 'VALIDATION' ? tc('errorBody') : state.error.message}
        </p>
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" disabled={activeStep === 0} onClick={() => setActiveStep((s) => Math.max(0, s - 1))}>
          {activeStep === 0 ? td('saved') : 'Back'}
        </Button>
        {activeStep < SMART_STEPS.length - 1 ? (
          <Button type="button" onClick={() => setActiveStep((s) => Math.min(SMART_STEPS.length - 1, s + 1))}>
            Next step <ArrowRight className="ml-2 size-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? tc('loading') : mode === 'create' ? t('createGoal') : t('save')}
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  id, label, name, value, onChange, type = 'text',
}: {
  id: string; label: string; name: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextField({
  id, label, name, value, onChange,
}: {
  id: string; label: string; name: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function normalize(initial?: GoalDraftFields): Partial<Values> {
  if (!initial) return {};
  const out: Partial<Values> = {};
  for (const [k, v] of Object.entries(initial)) {
    if (v != null) out[k as keyof Values] = String(v);
  }
  return out;
}
