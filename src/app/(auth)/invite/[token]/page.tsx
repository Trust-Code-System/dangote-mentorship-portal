import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { InviteStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { hashInviteToken } from '@/lib/auth/invite';
import { AuthCard, AuthHeader, AuthFooter } from '@/components/auth/auth-card';
import { AuthAlert } from '@/components/auth/auth-controls';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import { acceptInvite } from './actions';
import { InviteForm } from './invite-form';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('auth');

  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(token) } });

  const live = invite !== null && !invite.deletedAt;
  const valid =
    live && invite.status === InviteStatus.PENDING && invite.expiresAt >= new Date();

  // Three distinct failures, because the right next step differs for each:
  // an *expired* invite needs a new one from an administrator, an *already
  // used* one means the account exists and the person should sign in, and an
  // unrecognised token usually means the link was truncated in an email client.
  // The validity check itself is unchanged.
  if (!valid) {
    const used = Boolean(live && invite.status !== InviteStatus.PENDING);
    const expired = Boolean(live && invite.status === InviteStatus.PENDING);

    const title = used
      ? t('inviteUsedTitle')
      : expired
        ? t('inviteExpiredTitle')
        : t('inviteInvalidTitle');
    const body = used
      ? t('inviteUsedBody')
      : expired
        ? t('inviteExpiredBody')
        : t('inviteInvalidBody');

    return (
      <div>
        <AuthCard>
          <AuthHeader heading={t('inviteHeading')} />
          <AuthAlert tone="error" title={title}>
            {body}
          </AuthAlert>

          <div className="mt-6 flex flex-col gap-3">
            {used ? (
              <Link
                href="/login"
                className="inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-blak-green text-base font-semibold text-blak-black transition-colors hover:bg-blak-green-soft"
              >
                {t('submit')}
              </Link>
            ) : null}
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[#0A6E13] underline-offset-4 hover:underline"
            >
              {t('requestAccess')}
            </Link>
          </div>
        </AuthCard>

        <AuthFooter showTrustNote={false} />
      </div>
    );
  }

  const boundAction = acceptInvite.bind(null, token);

  return (
    <div>
      <AuthCard>
        <AuthHeader heading={t('inviteHeading')} supporting={t('inviteSupporting')} />
        <InviteForm
          action={boundAction}
          email={invite.email}
          requirements={<PasswordRequirements />}
        />
      </AuthCard>

      <AuthFooter showTrustNote={false} />
    </div>
  );
}
