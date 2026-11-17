'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/db/prisma';
import { signIn } from '@/lib/auth/auth';
import { hashPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/token';
import { clientIpFromHeaders } from '@/lib/auth/rate-limit';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { writeAuditLog } from '@/lib/audit/audit';

const resetSchema = z.object({ password: z.string().min(8).max(200) });

export type ResetPasswordState = { error?: 'invalid' | 'validation' | 'rate_limited' };

const RESET_LIMIT = 10;
const RESET_WINDOW_MS = 60_000;

// Consumes a password-reset token (CLAUDE.md §2). Validates the hashed token,
// sets the new password, marks the token used, then signs the user in — mirroring
// the invite-acceptance flow.
export async function resetPassword(
  token: string,
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const h = await headers();
  const ip = clientIpFromHeaders(h.get('x-forwarded-for'), h.get('x-real-ip'));
  if (!(await checkRateLimit(`reset-password:${ip}`, RESET_LIMIT, RESET_WINDOW_MS)).ok) {
    return { error: 'rate_limited' };
  }

  const parsed = resetSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: 'validation' };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (
    !record ||
    record.deletedAt ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    !record.user ||
    record.user.deletedAt ||
    !record.user.isActive
  ) {
    return { error: 'invalid' };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const email = record.user.email.toLowerCase();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    // Burn any other outstanding tokens for this user.
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, deletedAt: null, id: { not: record.id } },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog(
      {
        actorId: record.userId,
        action: 'password_reset.completed',
        entityType: 'User',
        entityId: record.userId,
      },
      tx,
    );
  });

  try {
    await signIn('credentials', {
      email,
      password: parsed.data.password,
      redirectTo: '/dashboard',
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: 'invalid' };
    throw error;
  }
}
