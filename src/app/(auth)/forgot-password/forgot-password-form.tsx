'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { requestPasswordReset, type ForgotPasswordState } from './actions';
import { AuthField } from '@/components/auth/auth-field';
import { AuthAlert, AuthSubmitButton } from '@/components/auth/auth-controls';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [state, formAction] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    {},
  );

  const backToSignIn = (
    <Link
      href="/login"
      className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0A6E13] underline-offset-4 hover:underline"
    >
      {t('backToSignIn')}
    </Link>
  );

  // Deliberately the same confirmation whether or not the address exists — this
  // page must never become an account-enumeration oracle. The behaviour comes
  // from the existing server action and is preserved exactly.
  if (state.status === 'sent') {
    return (
      <div>
        <AuthAlert tone="success" title={t('forgotSentTitle')}>
          {t('forgotSent')}
        </AuthAlert>
        <div className="mt-6 text-center">{backToSignIn}</div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <AuthField
        id="email"
        name="email"
        type="email"
        label={t('corporateEmail')}
        autoComplete="email"
        inputMode="email"
        placeholder={t('emailPlaceholder')}
        required
      />

      {state.status === 'invalid' || state.status === 'rate_limited' ? (
        <AuthAlert
          tone="error"
          title={state.status === 'rate_limited' ? t('tooManyAttempts') : t('invalid')}
        />
      ) : null}

      <AuthSubmitButton pendingLabel={t('signingIn')}>{t('forgotSubmit')}</AuthSubmitButton>

      <div className="pt-1 text-center">{backToSignIn}</div>
    </form>
  );
}
