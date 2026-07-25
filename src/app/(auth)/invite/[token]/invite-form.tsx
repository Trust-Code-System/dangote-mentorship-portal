'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AcceptInviteState } from './actions';
import { AuthField, PasswordField } from '@/components/auth/auth-field';
import { AuthAlert, AuthSubmitButton } from '@/components/auth/auth-controls';

type Action = (prev: AcceptInviteState, formData: FormData) => Promise<AcceptInviteState>;

export function InviteForm({
  action,
  email,
  requirements,
}: {
  action: Action;
  email: string;
  requirements: React.ReactNode;
}) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, formAction] = useActionState<AcceptInviteState, FormData>(action, {});
  const [mismatch, setMismatch] = useState(false);

  const errorMessage = {
    invalid: t('inviteInvalidTitle'),
    rate_limited: t('tooManyAttempts'),
    validation: tc('errorBody'),
  };

  /**
   * Confirm-password is a client-side guard only; the server action still reads
   * `name` + `password` exactly as before.
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
      {/* Read-only rather than disabled: a disabled input is skipped in the tab
          order, so a keyboard user could not read the address they are about to
          activate. The value is not submitted either way — the server takes the
          email from the invite record, never from this field. */}
      <AuthField
        id="email"
        type="email"
        label={t('corporateEmail')}
        defaultValue={email}
        readOnly
        hint={t('inviteEmailHelp')}
      />

      {/* This field was previously labelled with the *application name* —
          `tc('appName')` rendered the label as "BLAK MOH" instead of asking for
          the participant's name. */}
      <AuthField
        id="name"
        name="name"
        label={t('fullName')}
        autoComplete="name"
        placeholder={t('fullNamePlaceholder')}
        required
      />

      <PasswordField
        id="password"
        name="password"
        label={t('password')}
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

      <AuthSubmitButton pendingLabel={t('signingIn')}>{t('inviteAccept')}</AuthSubmitButton>
    </form>
  );
}
