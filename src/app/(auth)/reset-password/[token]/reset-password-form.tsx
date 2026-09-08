'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ResetPasswordState } from './actions';
import { PasswordField } from '@/components/auth/auth-field';
import { AuthAlert, AuthSubmitButton } from '@/components/auth/auth-controls';

type Action = (prev: ResetPasswordState, formData: FormData) => Promise<ResetPasswordState>;

export function ResetPasswordForm({
  action,
  requirements,
}: {
  action: Action;
  /** Rendered server-side and passed in, so the rules stay a server component. */
  requirements: React.ReactNode;
}) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, formAction] = useActionState<ResetPasswordState, FormData>(action, {});
  const [mismatch, setMismatch] = useState(false);

  const errorMessage = {
    invalid: t('resetInvalidTitle'),
    rate_limited: t('tooManyAttempts'),
    validation: tc('errorBody'),
  };

  /**
   * Confirm-password is a client-side guard only. The server action's contract
   * is unchanged — it still reads a single `password` field — so this adds a
   * safety net against typos without touching authentication logic.
   */
  function submit(formData: FormData) {
    if (formData.get('password') !== formData.get('confirmPassword')) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    formAction(formData);
  }

  return (
    <form action={submit} className="space-y-5" noValidate>
      <PasswordField
        id="password"
        name="password"
        label={t('newPassword')}
        autoComplete="new-password"
        minLength={8}
      />

      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={t('confirmPassword')}
        autoComplete="new-password"
        minLength={8}
        error={mismatch ? t('passwordMismatch') : undefined}
      />

      {requirements}

      {state.error ? <AuthAlert tone="error" title={errorMessage[state.error]} /> : null}

      <AuthSubmitButton pendingLabel={t('signingIn')}>{t('resetSubmit')}</AuthSubmitButton>
    </form>
  );
}
