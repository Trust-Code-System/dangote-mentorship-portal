import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Ticket, Mail } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/rbac';
import { defaultDashboardPath } from '@/lib/auth/roles';
import { AuthCard, AuthHeader, AuthFooter } from '@/components/auth/auth-card';
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
  // Demo default: the seeded super-admin address. Swap for a real support inbox
  // (or a routed contact form) before the pilot.
  const requestHref = 'mailto:admin@blakmoh.com?subject=Mentorship%20programme%20access%20request';

  return (
    <div>
      <AuthCard>
        <AuthHeader heading={ta('requestHeading')} supporting={t('subtitle')} />

        {/* Have an invite code → redeem it */}
        <section className="rounded-xl border border-auth-border bg-auth-field/60 p-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-blak-green/15 text-[#0A6E13]">
              <Ticket className="size-4" aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-auth-ink">{t('inviteTitle')}</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-auth-ink-2">{t('inviteHint')}</p>
          <div className="mt-4">
            <InviteCodeForm />
          </div>
        </section>

        {/* No invite yet → ask an administrator */}
        <section className="mt-5 rounded-xl border border-auth-border bg-auth-field/60 p-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-blak-gold/20 text-[#7A5411]">
              <Mail className="size-4" aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-auth-ink">{t('requestTitle')}</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-auth-ink-2">{t('requestHint')}</p>
          <a
            href={requestHref}
            className="mt-4 inline-flex h-[52px] w-full items-center justify-center rounded-xl border border-auth-border bg-auth-surface text-base font-semibold text-auth-ink transition-colors hover:bg-auth-border/40"
          >
            {t('requestCta')}
          </a>
        </section>

        <p className="mt-7 border-t border-auth-border pt-6 text-center text-sm text-auth-ink-2">
          {t('haveAccount')}{' '}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-semibold text-[#0A6E13] underline-offset-4 hover:underline"
          >
            {t('signinLink')}
          </Link>
        </p>
      </AuthCard>

      <AuthFooter showTrustNote={false} />
    </div>
  );
}
