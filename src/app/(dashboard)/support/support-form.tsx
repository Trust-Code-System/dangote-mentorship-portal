'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  submitSupportRequestForm,
  type SupportActionState,
} from '@/features/support/actions';
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

const REASONS = [
  'CANNOT_REACH_PARTNER',
  'NEED_GOAL_HELP',
  'UNCOMFORTABLE_WITH_MATCH',
  'NEED_ADMIN_INTERVENTION',
  'COMMUNICATION_ISSUE',
  'LANGUAGE_SUPPORT',
  'OTHER',
] as const;

// Private support request form (§1.13). The privacy notice is deliberate: the
// programme team always sees who raised it; it is anonymous only to other
// participants. Stating this in the UI is a CLAUDE.md §1.13 requirement.
export function SupportForm() {
  const t = useTranslations('support');
  const tc = useTranslations('common');
  const reasonId = useId();
  const messageId = useId();
  const router = useRouter();

  const [done, setDone] = useState(false);
  const [state, action, pending] = useActionState<SupportActionState, FormData>(
    submitSupportRequestForm,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setDone(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={action}
      onSubmit={() => setDone(false)}
      className="space-y-3"
    >
      <p className="rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
        {t('privacyNotice')}
      </p>

      <div className="space-y-1">
        <Label htmlFor={reasonId}>{t('reasonLabel')}</Label>
        <Select name="reason" required>
          <SelectTrigger id={reasonId}>
            <SelectValue placeholder={t('chooseReason')} />
          </SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`reason.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={messageId}>{t('messageLabel')}</Label>
        <Textarea id={messageId} name="message" maxLength={4000} placeholder={t('messageHint')} />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">
          {state.error.code === 'VALIDATION' ? tc('errorBody') : state.error.message}
        </p>
      ) : null}
      {done ? <p className="text-sm text-green-700">{t('submitted')}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? tc('loading') : t('submit')}
      </Button>
    </form>
  );
}
