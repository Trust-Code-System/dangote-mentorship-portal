import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import { getMyRequests } from '@/features/support/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SupportForm } from './support-form';

const STATUS_VARIANT = {
  OPEN: 'outline',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'secondary',
} as const;

// "Request Support Privately" (experience-layer.md §1.13). Available to any
// participant. The form is explicit that the programme team sees who asked — it
// is anonymous to other participants, not to admins.
export default async function SupportPage() {
  const user = await requireUser();
  const t = await getTranslations('support');

  const myRequests = await getMyRequests(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('newRequest')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SupportForm />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('myRequests')}</h2>
        {myRequests.length === 0 ? (
          <p className="text-muted-foreground">{t('noRequests')}</p>
        ) : (
          myRequests.map((r) => (
            <Card key={r.id}>
              <CardHeader className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{t(`reason.${r.reason}`)}</CardTitle>
                  <Badge variant={STATUS_VARIANT[r.status]}>{t(`status.${r.status}`)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.createdAt.toISOString().slice(0, 10)}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {r.message ? <p className="whitespace-pre-wrap">{r.message}</p> : null}
                {r.adminResponse ? (
                  <div className="rounded border bg-muted/30 p-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {t('adminResponse')}
                    </p>
                    <p className="whitespace-pre-wrap">{r.adminResponse}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('awaitingResponse')}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
