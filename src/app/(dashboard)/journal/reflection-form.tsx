'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  saveReflectionEntryForm,
  type ReflectionActionState,
} from '@/features/reflections/actions';
import { useFormDraft } from '@/components/use-form-draft';
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

type Lang = 'EN' | 'FR';
const PROMPT_KEYS = ['learned', 'action', 'challenge', 'feedback', 'support'] as const;
// Radix Select has no empty-value item; "no session" rides a sentinel while the
// form state keeps '' so the hidden input and draft stay unchanged.
const NO_SESSION = '__none__';

// Mentee's new reflection entry (experience-layer.md §1.16). Autosaves a draft so
// nothing is lost (§1.11); the post-session prompts are guidance, not required
// fields. Entries are private until the mentee explicitly shares one.
export function ReflectionForm({
  cohortId,
  defaultLang,
  logOptions,
}: {
  cohortId: string;
  defaultLang: Lang;
  logOptions: { id: string; label: string }[];
}) {
  const t = useTranslations('journal');
  const tc = useTranslations('common');
  const td = useTranslations('drafts');
  const titleId = useId();
  const bodyId = useId();
  const router = useRouter();

  const [values, setValues] = useState({ title: '', body: '', sessionLogId: '', bodyLang: defaultLang });
  const [state, action, pending] = useActionState<ReflectionActionState, FormData>(
    saveReflectionEntryForm,
    null,
  );

  const { status: draftStatus, clear } = useFormDraft({
    formKey: 'reflection:new',
    values,
    cohortId,
    enabled: true,
  });

  useEffect(() => {
    if (!state?.ok) return;
    void clear();
    router.refresh();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setValues({ title: '', body: '', sessionLogId: '', bodyLang: defaultLang });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form action={action} className="space-y-3">
      {draftStatus === 'saved' ? (
        <p className="text-xs text-muted-foreground">{td('saved')}</p>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor={titleId}>{t('entryTitle')}</Label>
        <Input
          id={titleId}
          name="title"
          maxLength={200}
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={t('entryTitleHint')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={bodyId}>{t('entryBody')}</Label>
        <Textarea
          id={bodyId}
          name="body"
          required
          maxLength={8000}
          className="min-h-[140px]"
          value={values.body}
          onChange={(e) => set('body', e.target.value)}
          placeholder={t('entryBodyHint')}
        />
        <ul className="ml-4 list-disc text-xs text-muted-foreground">
          {PROMPT_KEYS.map((k) => (
            <li key={k}>{t(`prompts.${k}`)}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="rf-session">{t('linkSession')}</Label>
          <input type="hidden" name="sessionLogId" value={values.sessionLogId} />
          <Select
            value={values.sessionLogId || NO_SESSION}
            onValueChange={(v) => set('sessionLogId', v === NO_SESSION ? '' : v)}
          >
            <SelectTrigger id="rf-session">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SESSION}>{t('noSession')}</SelectItem>
              {logOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rf-lang">{t('writtenIn')}</Label>
          <input type="hidden" name="bodyLang" value={values.bodyLang} />
          <Select value={values.bodyLang} onValueChange={(v) => set('bodyLang', v)}>
            <SelectTrigger id="rf-lang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EN">{tc('english')}</SelectItem>
              <SelectItem value="FR">{tc('french')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">
          {state.error.code === 'VALIDATION' ? tc('errorBody') : state.error.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !values.body.trim()}>
        {pending ? tc('loading') : t('saveEntry')}
      </Button>
    </form>
  );
}
