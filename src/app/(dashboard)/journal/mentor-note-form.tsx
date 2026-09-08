'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveMentorNoteForm, type ReflectionActionState } from '@/features/reflections/actions';
import { Button } from '@/components/ui/button';
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
const KINDS = ['observation', 'strength', 'growth', 'followup', 'idea'] as const;
// Radix Select has no empty-value item; "no category" rides a sentinel that we
// translate back to '' on the wire via a hidden input.
const NO_KIND = '__none__';

// Mentor's private note about a mentee (experience-layer.md §1.16). Private to the
// mentor — never shown to the mentee or admins. The `kind` is optional free
// categorization so mentors aren't boxed in.
export function MentorNoteForm({ menteeId, defaultLang }: { menteeId: string; defaultLang: Lang }) {
  const t = useTranslations('journal');
  const tc = useTranslations('common');
  const router = useRouter();

  const [body, setBody] = useState('');
  const [kind, setKind] = useState(NO_KIND);
  const [state, action, pending] = useActionState<ReflectionActionState, FormData>(
    saveMentorNoteForm,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setBody('');
      setKind(NO_KIND);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="space-y-2 rounded border bg-muted/20 p-3">
      <input type="hidden" name="menteeId" value={menteeId} />
      <Label htmlFor={`note-${menteeId}`}>{t('addNote')}</Label>
      <Textarea
        id={`note-${menteeId}`}
        name="body"
        required
        maxLength={8000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('notePlaceholder')}
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`kind-${menteeId}`} className="text-xs">
            {t('noteKind')}
          </Label>
          <input type="hidden" name="kind" value={kind === NO_KIND ? '' : kind} />
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger id={`kind-${menteeId}`} className="h-9 w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_KIND}>{t('noteKindNone')}</SelectItem>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`noteKinds.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select name="bodyLang" defaultValue={defaultLang}>
          <SelectTrigger aria-label={t('writtenIn')} className="h-9 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EN">{tc('english')}</SelectItem>
            <SelectItem value="FR">{tc('french')}</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? tc('loading') : t('saveNote')}
        </Button>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-destructive">
          {state.error.code === 'VALIDATION' ? tc('errorBody') : state.error.message}
        </p>
      ) : null}
    </form>
  );
}
