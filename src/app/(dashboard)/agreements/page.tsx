import { getLocale, getTranslations } from 'next-intl/server';
import { AgreementType, Language } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
import { getAgreementContext } from '@/features/agreements/data';
import { getAgreementTemplate } from '@/features/agreements/content';
import { REQUIRED_AGREEMENTS } from '@/features/agreements/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignAgreementForm } from './sign-form';

export default async function AgreementsPage() {
  const user = await requireUser();
  const t = await getTranslations('agreements');
  const ctx = await getAgreementContext(user.id);

  if (!ctx.eligible) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('notEligible')}</p>
      </section>
    );
  }

  // QA-I18N-006: follow the ACTIVE UI locale (header switcher), not the saved
  // account locale, so a French reader sees the agreement terms in French.
  const activeLocale = await getLocale();
  const lang = activeLocale.toLowerCase().startsWith('fr') ? Language.FR : Language.EN;
  const signedByType = new Map(ctx.signed.map((a) => [a.type, a]));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {REQUIRED_AGREEMENTS.map((type: AgreementType) => {
          const template = getAgreementTemplate(type, lang);
          const signed = signedByType.get(type);

          return (
            <Card key={type}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <CardTitle className="text-lg">{template.title}</CardTitle>
                {signed ? <Badge>{t('signedOn')}</Badge> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {template.intro.map((para, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {para}
                  </p>
                ))}
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {template.commitments.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>

                {signed ? (
                  <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">
                      {t('signedOn')}
                      {signed.signedAt ? `: ${signed.signedAt.toISOString().slice(0, 10)}` : ''}
                    </span>
                    {signed.hasPdf ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/agreements/${signed.id}/pdf`} target="_blank" rel="noreferrer">
                          {t('download')}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">{t('preparingPdf')}</span>
                    )}
                  </div>
                ) : (
                  <div className="border-t pt-4">
                    <SignAgreementForm
                      cohortId={ctx.cohortId}
                      type={type}
                      consentText={template.consent}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
