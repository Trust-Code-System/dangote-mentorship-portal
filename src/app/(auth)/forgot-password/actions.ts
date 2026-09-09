'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { clientIpFromHeaders } from '@/lib/auth/rate-limit';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { generateToken, passwordResetExpiry, PASSWORD_RESET_TTL_MINUTES } from '@/lib/auth/token';
import { sendEmail } from '@/lib/mail';
import { writeAuditLog } from '@/lib/audit/audit';

const requestSchema = z.object({ email: z.string().email() });

export type ForgotPasswordState = { status?: 'sent' | 'invalid' | 'rate_limited' };

// Throttle reset requests so the endpoint can't be used to spam mail or probe
// which addresses exist (CLAUDE.md §14).
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 60_000;

function resetBaseUrl(h: Headers): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, '');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

// Public "forgot password" request (CLAUDE.md §2: email/password fallback needs
// a recovery path). Always reports success so the response can't be used to
// enumerate accounts — a token is only created and emailed when the address
// matches an active credential user.
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = requestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { status: 'invalid' };

  const email = parsed.data.email.toLowerCase();
  const h = await headers();
  const ip = clientIpFromHeaders(h.get('x-forwarded-for'), h.get('x-real-ip'));
  if (!(await checkRateLimit(`forgot-password:${ip}:${email}`, REQUEST_LIMIT, REQUEST_WINDOW_MS)).ok) {
    return { status: 'rate_limited' };
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, isActive: true },
  });

  // Always return 'sent'; only do real work when the user exists.
  if (user) {
    const { token, tokenHash } = generateToken();

    // Invalidate any outstanding tokens for this user before issuing a new one.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: passwordResetExpiry() },
    });

    const link = `${resetBaseUrl(h)}/reset-password/${token}`;
    await sendEmail({
      to: email,
      subject: 'Reset your Dangote Mentorship Programme password',
      text: `We received a request to reset your password.\n\nReset it here (valid for ${PASSWORD_RESET_TTL_MINUTES} minutes):\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
    });

    await writeAuditLog({
      actorId: user.id,
      action: 'password_reset.requested',
      entityType: 'User',
      entityId: user.id,
    });
  }

  return { status: 'sent' };
}
