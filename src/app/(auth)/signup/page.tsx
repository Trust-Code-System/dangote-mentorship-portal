import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Ticket, Mail } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/rbac';
import { defaultDashboardPath } from '@/lib/auth/roles';
import { AuthCard, AuthHeader } from '@/components/auth/auth-card';
import { InviteCodeForm } from './invite-code-form';

// Request-access page (invite-only model, CLAUDE.md §2). No self-service account
// creation exists, and none is invented here: a visitor either activates an
// existing invite code (which routes into the /invite/[token] flow) or asks an
// administrator for one. Only the presentation changed.
export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(defaultDashboardPath(user.roles));

  const t = await getTranslations('signup');
  const ta = await getTranslations('auth');

  return (
    <div>
      <AuthCard>
        <AuthHeader heading={ta('requestHeading')} supporting={t('subtitle')} />

        {/* Have an invite code → redeem it */}
        <section className="border-auth-border bg-auth-field/60 rounded-xl border p-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-blak-green/15 inline-flex size-9 items-center justify-center rounded-lg text-[#0A6E13]">
              <Ticket className="size-4" aria-hidden />
            </span>
            <h2 className="text-auth-ink text-base font-semibold">{t('inviteTitle')}</h2>
          </div>
          <p className="text-auth-ink-2 mt-2 text-sm leading-relaxed">{t('inviteHint')}</p>
          <div className="mt-3">
            <InviteCodeForm />
          </div>
        </section>

        {/* No invite yet → ask an administrator */}
        <section className="border-auth-border bg-auth-field/60 mt-4 rounded-xl border p-4">
          <div className="flex items-center gap-2.5">
            <span className="bg-blak-gold/20 inline-flex size-9 items-center justify-center rounded-lg text-[#7A5411]">
              <Mail className="size-4" aria-hidden />
            </span>
            <h2 className="text-auth-ink text-base font-semibold">{t('requestTitle')}</h2>
          </div>
          <p className="text-auth-ink-2 mt-2 text-sm leading-relaxed">{t('requestHint')}</p>
          <Link
            href="/contact"
            className="border-auth-border bg-auth-surface text-auth-ink hover:bg-auth-border/40 mt-4 inline-flex h-[52px] w-full items-center justify-center rounded-xl border text-base font-semibold transition-colors"
          >
            {t('requestCta')}
          </Link>
        </section>

        <p className="border-auth-border text-auth-ink-2 mt-4 border-t pt-4 text-center text-sm">
          {t('haveAccount')}{' '}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-semibold text-[#0A6E13] underline-offset-4 hover:underline"
          >
            {t('signinLink')}
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
