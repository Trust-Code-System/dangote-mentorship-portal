'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createNewsletterForm, type CreateNewsletterState } from '@/features/newsletters/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Start a new issue by hand (the schedule creates them automatically on its
// days; this is for an extra or off-cycle send).
export function NewIssueForm({ cohortId }: { cohortId: string }) {
  const t = useTranslations('newsletters');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<CreateNewsletterState, FormData>(
    createNewsletterForm,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="space-y-1.5">
        <Label htmlFor="issue-title">{t('fieldTitle')}</Label>
        <Input
          id="issue-title"
          name="title"
          placeholder={t('titlePlaceholder')}
          maxLength={200}
          className="w-72"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? tc('loading') : t('newIssue')}
      </Button>
      {state && !state.ok ? (
        <p className="text-small text-risk" role="alert">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
