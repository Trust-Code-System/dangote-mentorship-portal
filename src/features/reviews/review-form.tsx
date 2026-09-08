'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReviewType } from '@prisma/client';
import type { FormField } from '@/features/forms/schema';
import { reviewDraftKey } from '@/features/reviews/schema';
import { submitReviewResponseForm, type ReviewFormState } from '@/features/reviews/actions';
import { useFormDraft } from '@/components/use-form-draft';
import { BilingualField } from '@/components/bilingual-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Lang = 'EN' | 'FR';
// A multi_select answer is a list of option values; everything else is a string.
type FieldValue = string | string[];
type Values = Record<string, FieldValue>;

// Review fill form (CLAUDE.md §5, M3). Renders whatever question set the admin
// published (Forms Builder), autosaves a draft so work is never lost
// (experience-layer.md §1.11), and submits answers as a single validated blob.
// Used by the mid-term and final review screens and — via `submitAction` /
// `extraFields` — by the recurring quarterly assessment, which posts the same
// answer blob to its own action. AI is not involved here: this is
// human-authored data.
export function ReviewForm({
  formId,
  type,
  fields,
  lang,
  cohortId,
  initial,
  submitAction = submitReviewResponseForm,
  draftKey,
  extraFields,
  submitLabel,
}: {
  formId: string;
  type: ReviewType;
  fields: FormField[];
  lang: Lang;
  cohortId: string;
  initial?: Values;
  /** Server action to post to. Defaults to the review submit action. */
  submitAction?: (state: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
  /** Autosave key. Defaults to the review draft key for this type + form. */
  draftKey?: string;
  /** Extra hidden inputs (e.g. the assessment window id). */
  extraFields?: Record<string, string>;
  submitLabel?: string;
}) {
  const t = useTranslations('reviews');
  const tc = useTranslations('common');
  const td = useTranslations('drafts');
  const router = useRouter();

  const [values, setValues] = useState<Values>(() => seed(fields, initial));
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitAction, null);

  const formKey = draftKey ?? reviewDraftKey(type, formId);
  const { status: draftStatus, clear } = useFormDraft({ formKey, values, cohortId });

  useEffect(() => {
    if (state?.ok) {
      void clear();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const serialized = useMemo(() => JSON.stringify(values), [values]);
  const fieldErrors = !state?.ok && state?.error.code === 'VALIDATION' ? state.error.fieldErrors : undefined;

  function set(id: string, value: FieldValue) {
    setValues((v) => ({ ...v, [id]: value }));
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="answers" value={serialized} />
      {Object.entries(extraFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {draftStatus === 'saved' ? (
        <p className="text-small text-ink-3" role="status">
          {td('saved')}
        </p>
      ) : null}

      {fields.map((field) => {
        const label = lang === 'FR' ? field.labelFr : field.labelEn;
        const error = fieldErrors?.[field.id]?.[0];
        return (
          <FieldRenderer
            key={field.id}
            field={field}
            label={label}
            lang={lang}
            value={values[field.id] ?? (field.type === 'multi_select' ? [] : '')}
            onChange={(v) => set(field.id, v)}
            error={error}
            yesWord={tc('yes')}
            noWord={tc('no')}
          />
        );
      })}

      {state && !state.ok && state.error.code !== 'VALIDATION' ? (
        <p className="text-small text-risk" role="alert">
          {state.error.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? tc('loading') : (submitLabel ?? t('submit'))}
      </Button>
    </form>
  );
}

function FieldRenderer({
  field,
  label,
  lang,
  value,
  onChange,
  error,
  yesWord,
  noWord,
}: {
  field: FormField;
  label: string;
  lang: Lang;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  error?: string;
  yesWord: string;
  noWord: string;
}) {
  // Every branch below except multi_select works on a single string.
  const single = Array.isArray(value) ? (value[0] ?? '') : value;
  const errorNode = error ? (
    <p className="text-small text-risk" role="alert">
      {error}
    </p>
  ) : null;

  if (field.type === 'short_text' || field.type === 'long_text') {
    return (
      <div className="space-y-1.5">
        <BilingualField
          id={`f-${field.id}`}
          name={`f-${field.id}`}
          label={label}
          lang={lang}
          as={field.type === 'short_text' ? 'input' : 'textarea'}
          value={single}
          onChange={onChange}
          required={field.required}
          rows={field.type === 'long_text' ? 4 : undefined}
        />
        {errorNode}
      </div>
    );
  }

  if (field.type === 'rating') {
    const max = field.max ?? 5;
    const scale = Array.from({ length: max }, (_, i) => i + 1);
    return (
      <fieldset className="space-y-1.5">
        <legend className="text-h3 text-ink">
          {label}
          {field.required ? <span className="ml-0.5 text-risk">*</span> : null}
        </legend>
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
          {scale.map((n) => {
            const selected = single === String(n);
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${n} / ${max}`}
                onClick={() => onChange(String(n))}
                className={cn(
                  'flex size-11 items-center justify-center rounded-md border text-body font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-green/30 focus:ring-offset-2 focus:ring-offset-bg',
                  selected
                    ? 'border-green bg-green text-white'
                    : 'border-border bg-bg text-ink hover:border-green',
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        {errorNode}
      </fieldset>
    );
  }

  if (field.type === 'boolean') {
    const choices: { v: string; label: string }[] = [
      { v: 'true', label: yesWord },
      { v: 'false', label: noWord },
    ];
    return (
      <fieldset className="space-y-1.5">
        <legend className="text-h3 text-ink">
          {label}
          {field.required ? <span className="ml-0.5 text-risk">*</span> : null}
        </legend>
        <div role="radiogroup" aria-label={label} className="flex gap-2">
          {choices.map((c) => {
            const selected = single === c.v;
            return (
              <button
                key={c.v}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(c.v)}
                className={cn(
                  'flex h-11 min-w-[5rem] items-center justify-center rounded-md border px-4 text-body transition-colors focus:outline-none focus:ring-2 focus:ring-green/30 focus:ring-offset-2 focus:ring-offset-bg',
                  selected
                    ? 'border-green bg-green text-white'
                    : 'border-border bg-bg text-ink hover:border-green',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {errorNode}
      </fieldset>
    );
  }

  if (field.type === 'multi_select') {
    const options = field.options ?? [];
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    const atLimit =
      field.maxSelections !== undefined && selected.length >= field.maxSelections;

    function toggle(optionValue: string) {
      // Keep the form's own option order rather than click order, so the stored
      // answer is comparable across submissions.
      const next = options
        .map((o) => o.value)
        .filter((v) =>
          v === optionValue ? !selected.includes(optionValue) : selected.includes(v),
        );
      onChange(next);
    }

    return (
      <fieldset className="space-y-1.5">
        <legend className="text-h3 text-ink">
          {label}
          {field.required ? <span className="ml-0.5 text-risk">*</span> : null}
        </legend>
        {field.maxSelections !== undefined ? (
          <p className="text-small text-ink-3">
            {lang === 'FR'
              ? `Choisissez jusqu'à ${field.maxSelections} option(s).`
              : `Choose up to ${field.maxSelections}.`}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-body transition-colors',
                  checked ? 'border-green bg-green-soft/40 text-ink' : 'border-border text-ink',
                  // Options beyond the cap are disabled rather than silently
                  // ignored on submit.
                  !checked && atLimit ? 'cursor-not-allowed opacity-50' : 'hover:border-green',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && atLimit}
                  onChange={() => toggle(option.value)}
                  className="mt-1 size-4 rounded border-border text-green focus:ring-2 focus:ring-green/30"
                />
                <span>{lang === 'FR' ? option.labelFr : option.labelEn}</span>
              </label>
            );
          })}
        </div>
        {errorNode}
      </fieldset>
    );
  }

  // single_select
  const options = field.options ?? [];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${field.id}`}>
        {label}
        {field.required ? <span className="ml-0.5 text-risk">*</span> : null}
      </Label>
      <Select value={single || undefined} onValueChange={onChange}>
        <SelectTrigger id={`f-${field.id}`} aria-label={label}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {lang === 'FR' ? o.labelFr : o.labelEn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errorNode}
    </div>
  );
}

/** Seed the form state: stored draft if present, else blank per field. */
function seed(fields: FormField[], initial?: Values): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = initial?.[f.id];
    if (f.type === 'multi_select') {
      // Must stay a list — String(['a','b']) would silently become "a,b" and
      // then match no option at all.
      out[f.id] = Array.isArray(v) ? v : v != null && v !== '' ? [String(v)] : [];
      continue;
    }
    out[f.id] = v != null ? String(v) : '';
  }
  return out;
}
