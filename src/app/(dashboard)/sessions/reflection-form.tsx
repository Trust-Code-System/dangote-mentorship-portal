'use client';

import { useActionState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveReflectionForm, type SessionActionState } from '@/features/sessions/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Mentor's shared reflection on a mentee-recorded session. The private journal
// is a separate feature; historical mentee reflections remain read-only.
export function ReflectionForm({ logId, initial }: { logId: string; initial: string }) {
  const t = useTranslations('sessions');
  const tc = useTranslations('common');
  const fieldId = useId();
  const router = useRouter();
  const [state, action, pending] = useActionState<SessionActionState, FormData>(
    saveReflectionForm,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="space-y-2 border-t pt-3">
      <input type="hidden" name="logId" value={logId} />
      <Label htmlFor={fieldId}>{t('mentorReflection')}</Label>
      <Textarea
        id={fieldId}
        name="reflection"
        defaultValue={initial}
        maxLength={5000}
        placeholder={t('reflectionHint')}
      />
      {state && !state.ok ? <p className="text-destructive text-sm">{tc('errorBody')}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? tc('loading') : t('saveReflection')}
      </Button>
    </form>
  );
}
