import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/auth/token';
import { AuthCard, AuthHeader, AuthFooter } from '@/components/auth/auth-card';
import { AuthAlert } from '@/components/auth/auth-controls';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import { resetPassword } from './actions';
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations('auth');

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  // The page previously collapsed every failure into one "invalid or expired"
  // line, which left someone holding a genuinely expired link with no idea that
  // requesting another would work. Expiry and invalidity are now distinct.
  //
  // This is safe to distinguish: reaching this page already requires possession
  // of the token, so telling its holder that it timed out reveals nothing to
  // anyone who does not have it. The token check itself is unchanged.
  const usable = record && !record.deletedAt && !record.usedAt;
  const expired = Boolean(usable && record.expiresAt < new Date());
  const valid = Boolean(usable && record.expiresAt >= new Date());

  if (!valid) {
    return (
      <div>
        <AuthCard>
          <AuthHeader heading={t('resetHeading')} />
          <AuthAlert tone="error" title={expired ? t('resetExpiredTitle') : t('resetInvalidTitle')}>
            {expired ? t('resetExpiredBody') : t('resetInvalidBody')}
          </AuthAlert>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/forgot-password"
              className="inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-blak-green text-base font-semibold text-blak-black transition-colors hover:bg-blak-green-soft"
            >
              {t('requestNewLink')}
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[#0A6E13] underline-offset-4 hover:underline"
            >
              {t('backToSignIn')}
            </Link>
          </div>
        </AuthCard>

        <AuthFooter showTrustNote={false} />
      </div>
    );
  }

  const boundAction = resetPassword.bind(null, token);

  return (
    <div>
      <AuthCard>
        <AuthHeader heading={t('resetHeading')} supporting={t('resetSupporting')} />
        <ResetPasswordForm action={boundAction} requirements={<PasswordRequirements />} />
      </AuthCard>

      <AuthFooter showTrustNote={false} />
    </div>
  );
}
