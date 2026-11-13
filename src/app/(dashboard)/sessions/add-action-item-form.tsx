'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { addActionItemForm, type SessionActionState } from '@/features/sessions/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mentor adds a follow-up action item to an existing session log (§1.6).
export function AddActionItemForm({ sessionLogId }: { sessionLogId: string }) {
  const t = useTranslations('sessions');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<SessionActionState, FormData>(
    addActionItemForm,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="sessionLogId" value={sessionLogId} />
      <Input
        name="title"
        required
        maxLength={300}
        placeholder={t('taskPlaceholder')}
        className="min-w-[12rem] flex-1"
        aria-label={t('task')}
      />
      <Select name="assignee" defaultValue="mentee">
        <SelectTrigger aria-label={t('owner')} className="w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mentee">{t('owner_mentee')}</SelectItem>
          <SelectItem value="mentor">{t('owner_mentor')}</SelectItem>
          <SelectItem value="none">{t('owner_none')}</SelectItem>
        </SelectContent>
      </Select>
      <Input type="date" name="due" aria-label={t('dueDate')} className="w-auto" />
      <Button type="submit" variant="outline" disabled={pending}>
        {t('addActionItem')}
      </Button>
    </form>
  );
}
