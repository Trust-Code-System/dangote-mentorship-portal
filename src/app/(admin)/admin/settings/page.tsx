import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, hasAnyRole } from '@/lib/auth/rbac';
import { RoleName } from '@/lib/auth/roles';
import { isMaintenanceMode } from '@/features/settings/maintenance';
import { getIntegrationHealth } from '@/lib/integrations/health';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MaintenanceToggle } from './maintenance-toggle';

// Platform settings live with the Super Admin (CLAUDE.md §4: "Manage
// platform/cohorts" is Super-Admin only). Programme Admins can reach the rest of
// the admin area but not this page.
export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAnyRole(user, RoleName.SUPER_ADMIN)) redirect('/admin');

  const t = await getTranslations('settings');
  const enabled = await isMaintenanceMode();
  const integrations = getIntegrationHealth();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('maintenanceTitle')}</CardTitle>
          <CardDescription>{t('maintenanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <MaintenanceToggle initialEnabled={enabled} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">{t('integrationsTitle')}</h2>
          <p className="text-muted-foreground text-sm">{t('integrationsDescription')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ['resend', integrations.resend],
              ['entra', integrations.entra],
              ['graphMail', integrations.graphMail],
              ['graphCalendar', integrations.graphCalendar],
            ] as const
          ).map(([key, item]) => (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{t(`integration.${key}`)}</CardTitle>
                  <Badge
                    variant={item.configured ? 'ok' : item.mode === 'partial' ? 'warn' : 'neutral'}
                  >
                    {t(`integrationStatus.${item.mode}`)}
                  </Badge>
                </div>
                <CardDescription>{t(`integration.${key}Description`)}</CardDescription>
              </CardHeader>
              {!item.configured ? (
                <CardContent>
                  <p className="text-muted-foreground text-xs font-semibold uppercase">
                    {t('missingVariables')}
                  </p>
                  <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                    {item.missing.map((name) => (
                      <li key={name}>
                        <code>{name}</code>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
