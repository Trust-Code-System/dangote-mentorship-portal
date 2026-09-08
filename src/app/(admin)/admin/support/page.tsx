import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getSupportQueue, countOpen } from '@/features/support/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SupportRespondForm } from './support-respond-form';

const STATUS_VARIANT = {
  OPEN: 'destructive',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'outline',
} as const;

// Private admin queue for support requests (experience-layer.md §1.13). Admin
// roles only (gated again in the action). Admins always see the requester.
export default async function AdminSupportPage() {
  const admin = await requireRole(ADMIN_ROLES);
  const t = await getTranslations('support');

  const requests = await getSupportQueue(admin);
  const open = countOpen(requests);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('queueTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('queueSubtitle', { open })}</p>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground">{t('queueEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{t(`reason.${r.reason}`)}</CardTitle>
                  <Badge variant={STATUS_VARIANT[r.status]}>{t(`status.${r.status}`)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.requesterName ?? r.requesterEmail} · {r.requesterEmail}
                  {r.cohortName ? ` · ${r.cohortName}` : ''} · {r.createdAt.toISOString().slice(0, 10)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {r.message ? (
                  <p className="whitespace-pre-wrap">{r.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('noMessage')}</p>
                )}
                {r.handledByName ? (
                  <p className="text-xs text-muted-foreground">
                    {t('handledBy', { name: r.handledByName })}
                  </p>
                ) : null}
                <SupportRespondForm
                  requestId={r.id}
                  status={r.status}
                  initialResponse={r.adminResponse ?? ''}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
