import { getTranslations } from 'next-intl/server';
import { AuthCard, AuthHeader, AuthFooter } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from './forgot-password-form';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');

  return (
    <div>
      <AuthCard>
        <AuthHeader heading={t('forgotHeading')} supporting={t('forgotSupporting')} />
        <ForgotPasswordForm />
      </AuthCard>

      <AuthFooter showTrustNote={false} />
    </div>
  );
}
