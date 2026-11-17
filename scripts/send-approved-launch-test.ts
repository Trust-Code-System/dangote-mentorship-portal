import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { getMailTransport } from '../src/lib/mail';

// Explicit owner approval in this chat, 17 November 2026. This is one attempt
// to one existing account, reserved durably before sending. A failed/ambiguous
// attempt is never retried automatically, including on a repeated build.
export async function sendApprovedLaunchTest(): Promise<void> {
  if (process.env.SEND_APPROVED_LAUNCH_TEST !== 'true') return;
  if (process.env.VERCEL_ENV !== 'production') throw new Error('Launch mail requires production.');
  const db = new PrismaClient();
  const auditId = 'launch-mail-2026-11-17';
  const recipientId = 'cmwc5tn6m0004fizg6xvh6sgo';
  const expectedRecipient = 'd8ea78af72aac767f68c9f1d1d52dc1e34c53b55ade719013b5c8ed013913aef';
  try {
    const address = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(17112026)::text`;
      if (await tx.auditLog.findUnique({ where: { id: auditId } })) return null;
      const recipient = await tx.user.findFirst({
        where: { id: recipientId, isActive: true, deletedAt: null },
        select: { email: true },
      });
      if (
        !recipient ||
        createHash('sha256').update(recipient.email).digest('hex') !== expectedRecipient
      ) {
        throw new Error('The approved recipient does not match the existing account.');
      }
      const actor = await tx.user.findFirst({
        where: { id: 'cmryti4iy0003fi38y2k2bqj6', isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!actor || getMailTransport().id !== 'smtp')
        throw new Error('Approved mail prerequisites failed.');
      await tx.auditLog.create({
        data: {
          id: auditId,
          actorId: actor.id,
          action: 'production.test_email',
          entityType: 'User',
          entityId: recipientId,
          metadata: { status: 'reserved', attempts: 1, ownerApproved: true },
        },
      });
      return recipient.email;
    });
    if (!address) {
      console.info('[release] Approved test email already attempted; no duplicate sent.');
      return;
    }
    try {
      await getMailTransport().send({
        to: address,
        subject: 'Mentorship portal production check',
        text: 'This is a one-time delivery test for the mentorship portal. No action is required.',
      });
      await db.auditLog.update({
        where: { id: auditId },
        data: {
          metadata: { status: 'provider_accepted', attempts: 1, ownerApproved: true },
        },
      });
    } catch {
      await db.auditLog.update({
        where: { id: auditId },
        data: {
          metadata: { status: 'failed_or_unknown', attempts: 1, ownerApproved: true },
        },
      });
      throw new Error(
        'The approved test email failed or has an unknown outcome; no automatic retry.',
      );
    }
    console.info(
      '[release] One approved test email accepted by SMTP; inbox receipt is not yet confirmed.',
    );
  } finally {
    await db.$disconnect();
  }
}
