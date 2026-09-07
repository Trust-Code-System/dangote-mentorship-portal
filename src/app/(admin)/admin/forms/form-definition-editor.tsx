'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ReviewType, RoleName } from '@prisma/client';
import {
  createFormDefinitionForm,
  updateFormDefinitionForm,
  type FormDefinitionFormState,
} from '@/features/forms/form-actions';
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from '@/features/forms/schema';
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

type CohortOption = { id: string; name: string };

// Radix Select has no empty-value item; "all roles" rides a sentinel that the
// hidden input translates back to '' on the wire.
const ALL_ROLES = '__all__';

type EditableOption = { value: string; labelEn: string; labelFr: string };
type EditableField = {
  id: string;
  labelEn: string;
  labelFr: string;
  type: FormFieldType;
  required: boolean;
  max: number;
  options: EditableOption[];
};

export interface FormDefinitionInitial {
  id: string;
  cohortId: string;
  type: ReviewType;
  roleName: RoleName | null;
  title: string;
  isActive: boolean;
  fields: FormField[];
}

function makeId(): string {
  // Stable, URL-safe key for a question. Crypto where available, else fallback.
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `q_${rand}`;
}

function blankField(): EditableField {
  return { id: makeId(), labelEn: '', labelFr: '', type: 'short_text', required: false, max: 5, options: [] };
}

function toEditable(field: FormField): EditableField {
  return {
    id: field.id,
    labelEn: field.labelEn,
    labelFr: field.labelFr,
    type: field.type,
    required: field.required,
    max: field.max ?? 5,
    options: (field.options ?? []).map((o) => ({ value: o.value, labelEn: o.labelEn, labelFr: o.labelFr })),
  };
}

function serialize(fields: EditableField[]): string {
  return JSON.stringify({
    fields: fields.map((f) => ({
      id: f.id,
      labelEn: f.labelEn.trim(),
      labelFr: f.labelFr.trim(),
      type: f.type,
      required: f.required,
      ...(f.type === 'rating' ? { max: f.max } : {}),
      ...(f.type === 'single_select' || f.type === 'multi_select'
        ? { options: f.options.map((o) => ({ value: o.value.trim(), labelEn: o.labelEn.trim(), labelFr: o.labelFr.trim() })) }
        : {}),
    })),
  });
}

export function FormDefinitionEditor({
  cohorts,
  initial,
}: {
  cohorts: CohortOption[];
  initial?: FormDefinitionInitial;
}) {
  const t = useTranslations('forms');
  const tc = useTranslations('common');
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [fields, setFields] = useState<EditableField[]>(
    initial && initial.fields.length > 0 ? initial.fields.map(toEditable) : [blankField()],
  );
  const [roleName, setRoleName] = useState<string>(initial?.roleName ?? '');

  const action = isEdit ? updateFormDefinitionForm : createFormDefinitionForm;
  const [state, formAction, pending] = useActionState<FormDefinitionFormState, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) router.push('/admin/forms');
  }, [state, router]);

  const fieldTypeLabels = useMemo<Record<FormFieldType, string>>(
    () => ({
      short_text: t('typeShortText'),
      long_text: t('typeLongText'),
      rating: t('typeRating'),
      single_select: t('typeSelect'),
      multi_select: t('typeMultiSelect'),
      boolean: t('typeBoolean'),
    }),
    [t],
  );

  function patch(index: number, change: Partial<EditableField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...change } : f)));
  }
  function move(index: number, delta: number) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + delta;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }
  function addOption(fieldIndex: number) {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex ? { ...f, options: [...f.options, { value: '', labelEn: '', labelFr: '' }] } : f,
      ),
    );
  }
  function patchOption(fieldIndex: number, optIndex: number, change: Partial<EditableOption>) {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex
          ? { ...f, options: f.options.map((o, oi) => (oi === optIndex ? { ...o, ...change } : o)) }
          : f,
      ),
    );
  }

  const schemaError = state && !state.ok ? state.error.fieldErrors?.schema?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-6">
      {isEdit ? <input type="hidden" name="id" value={initial!.id} /> : null}
      <input type="hidden" name="schema" value={serialize(fields)} />

      <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cohortId">{t('cohort')}</Label>
          <Select name="cohortId" required defaultValue={initial?.cohortId ?? cohorts[0]?.id}>
            <SelectTrigger id="cohortId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">{t('reviewType')}</Label>
          <Select name="type" required defaultValue={initial?.type ?? ReviewType.MIDTERM}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ReviewType.MIDTERM}>{t('midterm')}</SelectItem>
              <SelectItem value={ReviewType.FINAL}>{t('final')}</SelectItem>
              <SelectItem value={ReviewType.QUARTERLY}>{t('quarterly')}</SelectItem>
              <SelectItem value={ReviewType.MONTHLY}>{t('monthly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">{t('formTitle')}</Label>
          <Input id="title" name="title" required maxLength={200} defaultValue={initial?.title ?? ''} />
          {state && !state.ok && state.error.fieldErrors?.title ? (
            <p className="text-sm text-risk">{state.error.fieldErrors.title[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="roleName">{t('targetRole')}</Label>
          <input type="hidden" name="roleName" value={roleName} />
          <Select
            value={roleName || ALL_ROLES}
            onValueChange={(v) => setRoleName(v === ALL_ROLES ? '' : v)}
          >
            <SelectTrigger id="roleName">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROLES}>{t('allRoles')}</SelectItem>
              <SelectItem value={RoleName.MENTOR}>{t('roleMentor')}</SelectItem>
              <SelectItem value={RoleName.MENTEE}>{t('roleMentee')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={initial?.isActive ?? true}
            className="h-4 w-4"
          />
          {t('active')}
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h1 text-ink">{t('questions')}</h2>
          <Button type="button" variant="outline" onClick={() => setFields((p) => [...p, blankField()])}>
            {t('addQuestion')}
          </Button>
        </div>

        {schemaError ? <p className="text-sm text-risk">{schemaError}</p> : null}
        {fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-3">
            {t('noQuestions')}
          </p>
        ) : null}

        {fields.map((field, index) => (
          <fieldset key={field.id} className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-micro uppercase text-ink-3">
                {t('questionN', { n: index + 1 })}
              </legend>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('moveUp')}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('moveDown')}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('removeQuestion')}
                  onClick={() => setFields((p) => p.filter((_, i) => i !== index))}
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`${field.id}-en`}>{t('labelEn')}</Label>
                <Input
                  id={`${field.id}-en`}
                  value={field.labelEn}
                  onChange={(e) => patch(index, { labelEn: e.target.value })}
                  maxLength={400}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${field.id}-fr`}>{t('labelFr')}</Label>
                <Input
                  id={`${field.id}-fr`}
                  value={field.labelFr}
                  onChange={(e) => patch(index, { labelFr: e.target.value })}
                  maxLength={400}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <Label htmlFor={`${field.id}-type`}>{t('answerType')}</Label>
                <Select
                  value={field.type}
                  onValueChange={(v) => patch(index, { type: v as FormFieldType })}
                >
                  <SelectTrigger id={`${field.id}-type`} className="w-auto min-w-[12rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft} value={ft}>
                        {fieldTypeLabels[ft]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {field.type === 'rating' ? (
                <div className="space-y-1">
                  <Label htmlFor={`${field.id}-max`}>{t('ratingMax')}</Label>
                  <Input
                    id={`${field.id}-max`}
                    type="number"
                    min={2}
                    max={10}
                    value={field.max}
                    onChange={(e) => patch(index, { max: Number(e.target.value) })}
                    className="w-24"
                  />
                </div>
              ) : null}

              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => patch(index, { required: e.target.checked })}
                  className="h-4 w-4"
                />
                {t('required')}
              </label>
            </div>

            {field.type === 'single_select' || field.type === 'multi_select' ? (
              <div className="space-y-2 rounded-md border border-border bg-bg p-3">
                <p className="text-small text-ink-2">{t('options')}</p>
                {field.options.map((opt, oi) => (
                  <div key={oi} className="grid gap-2 sm:grid-cols-3">
                    <Input
                      aria-label={t('optionValue')}
                      placeholder={t('optionValue')}
                      value={opt.value}
                      onChange={(e) => patchOption(index, oi, { value: e.target.value })}
                    />
                    <Input
                      aria-label={t('optionLabelEn')}
                      placeholder={t('optionLabelEn')}
                      value={opt.labelEn}
                      onChange={(e) => patchOption(index, oi, { labelEn: e.target.value })}
                    />
                    <Input
                      aria-label={t('optionLabelFr')}
                      placeholder={t('optionLabelFr')}
                      value={opt.labelFr}
                      onChange={(e) => patchOption(index, oi, { labelFr: e.target.value })}
                    />
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => addOption(index)}>
                  {t('addOption')}
                </Button>
              </div>
            ) : null}
          </fieldset>
        ))}
      </div>

      {state && !state.ok && !state.error.fieldErrors ? (
        <p className="text-sm text-risk">{tc('errorBody')}</p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {isEdit ? tc('save') : t('createForm')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/forms')}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
