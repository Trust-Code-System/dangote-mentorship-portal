import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/rbac';
import { defaultDashboardPath } from '@/lib/auth/roles';
import { isEntraConfigured } from '@/lib/auth/entra';
import { AuthCard, AuthHeader, AuthFooter } from '@/components/auth/auth-card';
import { AuthAlert } from '@/components/auth/auth-controls';
import { LoginForm } from './login-form';

// Login. Auth wiring (Entra SSO gating, credentials action, rate limiting) is
// unchanged — this is the visual and UX layer only (AUTH_UI_SPEC.md).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; error?: string }>;
}) {
  // Already signed in → go straight to the role-correct dashboard.
  const user = await getCurrentUser();
  if (user) redirect(defaultDashboardPath(user.roles));

  const t = await getTranslations('auth');
  const params = await searchParams;

  // Session-expiry and provider-error are query states on /login rather than
  // separate routes: Auth.js already redirects here (`pages.signIn`), so adding
  // routes would mean changing auth configuration for no user-facing gain.
  // The provider's own error code is never rendered — only our own copy.
  const notice = params.expired
    ? ({ tone: 'info', title: t('sessionExpiredTitle'), body: t('sessionExpiredBody') } as const)
    : params.error
      ? ({ tone: 'error', title: t('authErrorTitle'), body: t('authErrorBody') } as const)
      : null;

  return (
    <div>
      <AuthCard>
        <AuthHeader heading={t('loginHeading')} supporting={t('loginSupporting')} />

        {notice ? (
          <AuthAlert tone={notice.tone} title={notice.title} className="mb-6">
            {notice.body}
          </AuthAlert>
        ) : null}

        <LoginForm entraEnabled={isEntraConfigured()} />

        <p className="mt-7 border-t border-auth-border pt-6 text-center text-sm text-auth-ink-2">
          {t('noAccount')}{' '}
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center font-semibold text-[#0A6E13] underline-offset-4 hover:underline"
          >
            {t('requestAccess')}
          </Link>
        </p>
      </AuthCard>

      <AuthFooter />
    </div>
  );
}
