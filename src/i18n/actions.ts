'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { Language } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, hasAnyRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getViewerCohortLanguages } from '@/features/cohorts/language-data';
import { isAppLocale, LOCALE_COOKIE, type AppLocale } from './config';

// Persist the user's interface language (CLAUDE.md §14: user-selected interface
// language persisted). Sets the cookie for guests and also the DB column for
// signed-in users so it follows them across devices.
export async function setLocale(locale: AppLocale): Promise<void> {
  if (!isAppLocale(locale)) return;

  const user = await getCurrentUser();
  let nextLocale = locale;

  // Public visitors and programme admins keep the full bilingual interface.
  // Participants can only select a language their own cohort offers. This also
  // closes the server-action path if somebody manually posts `fr` after an
  // admin has turned French off.
  if (user && !hasAnyRole(user, ADMIN_ROLES)) {
    const languages = await getViewerCohortLanguages(user.id);
    const requested = locale === 'fr' ? Language.FR : Language.EN;
    if (!languages.includes(requested)) {
      nextLocale = languages.includes(Language.FR) ? 'fr' : 'en';
    }
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, nextLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { locale: nextLocale === 'fr' ? Language.FR : Language.EN },
    });
  }

  // Cookie writes alone do not refresh the RSC tree in production (`next start`).
  // Revalidate the root layout so `<html lang>` and next-intl messages update
  // in place — without a full navigation that would wipe half-typed forms.
  revalidatePath('/', 'layout');
}
