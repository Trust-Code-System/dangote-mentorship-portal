'use client';

import { useActionState } from 'react';
import { setMenteeCertificatePermission } from '@/features/certificate/actions';
import { Button } from '@/components/ui/button';

export function CertificateReleaseControl({
  matchId,
  approved,
  requirementsMet,
}: {
  matchId: string;
  approved: boolean;
  requirementsMet: boolean;
}) {
  const [state, action, pending] = useActionState(
    async (_: Awaited<ReturnType<typeof setMenteeCertificatePermission>> | null, data: FormData) =>
      setMenteeCertificatePermission(data),
    null,
  );
  return (
    <form action={action} className="bg-surface border-border space-y-3 rounded-xl border p-4">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="decision" value={approved ? 'revoke' : 'approve'} />
      <p className="font-semibold">Mentee certificate release</p>
      <p className="text-small text-ink-2">
        {approved
          ? 'Approved by an administrator. Revoke permission to lock the certificate again.'
          : 'Locked. Completing the programme does not release this certificate automatically.'}
      </p>
      {!requirementsMet && !approved ? (
        <p className="text-small text-ink-2">
          Complete the programme requirements before approving release.
        </p>
      ) : null}
      <Button
        disabled={pending || (!approved && !requirementsMet)}
        variant={approved ? 'outline' : 'default'}
      >
        {pending
          ? 'Saving…'
          : approved
            ? 'Revoke certificate permission'
            : 'Mark passed and permit certificate'}
      </Button>
      {state ? (
        <p role={state.ok ? 'status' : 'alert'} className="text-small">
          {state.ok
            ? state.data.approved
              ? 'Certificate permission approved.'
              : 'Certificate permission revoked.'
            : state.error.message}
        </p>
      ) : null}
    </form>
  );
}
