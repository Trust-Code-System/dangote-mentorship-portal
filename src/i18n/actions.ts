'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { Language } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/rbac';
import { isAppLocale, LOCALE_COOKIE, type AppLocale } from './config';

// Persist the user's interface language (CLAUDE.md §14: user-selected interface
// language persisted). Sets the cookie for guests and also the DB column for
// signed-in users so it follows them across devices.
export async function setLocale(locale: AppLocale): Promise<void> {
  if (!isAppLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { locale: locale === 'fr' ? Language.FR : Language.EN },
    });
  }

  // Cookie writes alone do not refresh the RSC tree in production (`next start`).
  // Revalidate the root layout so `<html lang>` and next-intl messages update
  // in place — without a full navigation that would wipe half-typed forms.
  revalidatePath('/', 'layout');
}
