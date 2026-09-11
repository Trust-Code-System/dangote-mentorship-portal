import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Wrench } from 'lucide-react';
import { getCurrentUser, hasAnyRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { isMaintenanceMode } from '@/features/settings/maintenance';
import { signOutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { BrandPlate } from '@/components/brand-logo';

// Holding page shown to participants while maintenance mode is on. It re-derives
// state so it can't be used as a dead-end: if the window has ended, or an admin
// lands here, they're sent straight back into the app.
export default async function MaintenancePage() {
  const [enabled, user, t] = await Promise.all([
    isMaintenanceMode(),
    getCurrentUser(),
    getTranslations('maintenance'),
  ]);

  if (!enabled) redirect('/dashboard');
  if (user && hasAnyRole(user, ADMIN_ROLES)) redirect('/admin');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandPlate className="h-9" />
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Wrench className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('body')}</p>
        </div>
        {user ? (
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full">
              {t('signOut')}
            </Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
