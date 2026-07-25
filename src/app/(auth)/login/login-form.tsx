'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';
import { login, type LoginState } from './actions';
import { signInWithEntra } from '@/lib/auth/actions';
import { AuthField, PasswordField } from '@/components/auth/auth-field';
import { AuthAlert, AuthDivider, AuthSubmitButton } from '@/components/auth/auth-controls';

/**
 * Credentials sign-in.
 *
 * The `login` server action, its rate limiting and its redirect behaviour are
 * untouched — this is the presentation layer.
 *
 * Two deliberate changes to what the form *contains*:
 *
 *  - **The "Remember me for 30 days" checkbox is gone.** The `remember` field
 *    was submitted but read by nothing (no consumer anywhere in `src/`), and
 *    the session is hard-capped at 12 hours in `auth.config.ts`. It was a
 *    control that did nothing while making a promise the system does not keep.
 *    See AUTH_UI_IMPLEMENTATION_REPORT.md — re-add it with real backend support
 *    and a truthful label.
 *  - **The SSO button still renders only when Entra is actually configured.**
 *    That gate is preserved exactly: a half-configured tenant makes Auth.js run
 *    OIDC discovery against an invalid issuer, which breaks *every* sign-in
 *    including credentials.
 */
export function LoginForm({ entraEnabled }: { entraEnabled: boolean }) {
  const t = useTranslations('auth');
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});
  // React 19 resets an uncontrolled form once its action settles, so after a
  // failed sign-in the email box came back empty and had to be retyped. Holding
  // the email in state keeps it; the PASSWORD is deliberately left uncontrolled
  // so it is cleared on failure, which is the behaviour you want.
  const [email, setEmail] = useState('');

  return (
    <div>
      {entraEnabled ? (
        <>
          <form action={signInWithEntra}>
            <button
              type="submit"
              className="inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border border-auth-border bg-auth-field text-base font-semibold text-auth-ink transition-colors hover:bg-auth-border/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-blak-green/25"
            >
              <Building2 className="size-5 text-[#0A6E13]" aria-hidden />
              {t('dangoteSso')}
            </button>
          </form>
          <AuthDivider label={t('orContinueWithEmail')} />
        </>
      ) : null}

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
          value={email}
          onChange={setEmail}
        />

        <PasswordField
          id="password"
          label={t('password')}
          autoComplete="current-password"
          trailing={
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center text-sm font-medium text-[#0A6E13] underline-offset-4 hover:underline"
            >
              {t('forgotLink')}
            </Link>
          }
        />

        {/* One message for both wrong-email and wrong-password: never reveal
            whether an account exists for the address. */}
        {state.error ? (
          <AuthAlert
            tone="error"
            title={state.error === 'rate_limited' ? t('tooManyAttempts') : t('invalid')}
          />
        ) : null}

        <AuthSubmitButton pendingLabel={t('signingIn')}>{t('submit')}</AuthSubmitButton>
      </form>
    </div>
  );
}
