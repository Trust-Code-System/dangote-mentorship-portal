'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createInviteForm, type InviteFormState } from '@/features/invites/form-actions';
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

// Radix Select can't carry an empty-string item value, so "no cohort" uses a
// sentinel that we translate back to '' on the wire via a hidden input.
const NO_COHORT = '__none__';

export function InviteCreateForm({
  roles,
  cohorts,
}: {
  roles: string[];
  cohorts: CohortOption[];
}) {
  const t = useTranslations('invites');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<InviteFormState, FormData>(
    createInviteForm,
    null,
  );
  const [copied, setCopied] = useState(false);
  const [cohortId, setCohortId] = useState(NO_COHORT);

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setCohortId(NO_COHORT);
      setCopied(false);
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  // The raw token exists only in this response — build the link client-side.
  const inviteUrl =
    state?.ok && typeof window !== 'undefined'
      ? `${window.location.origin}/invite/${state.data.token}`
      : null;

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" required maxLength={254} />
        {state && !state.ok && state.error.fieldErrors?.email ? (
          <p className="text-sm text-destructive">{state.error.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="roleName">{t('role')}</Label>
          <Select name="roleName" required defaultValue={roles[0]}>
            <SelectTrigger id="roleName">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cohortId">{t('cohort')}</Label>
          <input type="hidden" name="cohortId" value={cohortId === NO_COHORT ? '' : cohortId} />
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger id="cohortId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COHORT}>{t('noCohort')}</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {inviteUrl ? (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium">{t('created')}</p>
          <p className="break-all font-mono text-xs">{inviteUrl}</p>
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
      ) : null}
      {state && !state.ok && !state.error.fieldErrors ? (
        <p className="text-sm text-destructive">
          {state.error.code === 'CONFLICT'
            ? t('conflict')
            : state.error.code === 'FORBIDDEN'
              ? t('adminOnly')
              : tc('errorBody')}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {t('create')}
      </Button>
    </form>
  );
}
