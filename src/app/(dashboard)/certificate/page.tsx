import Link from 'next/link';
import { CheckCircle2, Circle, Download, FileCheck2, Languages, ShieldCheck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import { getCertificateData, type CertificateLanguage } from '@/features/certificate/data';
import { CertificateView } from '@/features/certificate/certificate-view';
import { CertificatePrintButton } from '@/features/certificate/print-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  html, body { width: 297mm; height: 210mm; background: #fff !important; }
  body * { visibility: hidden !important; }
  #certificate, #certificate * { visibility: visible !important; }
  #certificate {
    position: fixed !important; inset: 0 !important;
    width: 297mm !important; height: 210mm !important; max-width: none !important;
    margin: 0 !important; box-shadow: none !important;
    print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important;
  }
}
`;

function selectedLanguage(value: string | undefined, fallback: string): CertificateLanguage {
  if (value?.toUpperCase() === 'FR') return 'FR';
  if (value?.toUpperCase() === 'EN') return 'EN';
  return fallback.toLowerCase().startsWith('fr') ? 'FR' : 'EN';
}

export default async function CertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [data, locale, t] = await Promise.all([
    getCertificateData(user.id),
    getLocale(),
    getTranslations('certificate'),
  ]);
  const lang = selectedLanguage(params.lang, locale);

  if (!data) {
    return (
      <section className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <Badge variant="outline">{t('statusLocked')}</Badge>
          <h1 className="font-display text-h1 text-ink font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-ink-2 max-w-2xl">{t('noPairing')}</p>
        </header>
        <div className="border-border bg-surface rounded-xl border border-dashed p-8 text-center">
          <ShieldCheck className="text-ink-3 mx-auto size-10" aria-hidden="true" />
          <p className="text-ink mt-3 font-medium">{t('emptyTitle')}</p>
          <p className="text-small text-ink-2 mt-1">{t('emptyBody')}</p>
        </div>
      </section>
    );
  }

  const requirements = [
    ['training', data.eligibility.trainingCompleted],
    ['goal', data.eligibility.goalApproved],
    ['midterm', data.eligibility.midtermSubmitted],
    ['final', data.eligibility.finalSubmitted],
  ] as const;
  const pdfUrl = `/api/certificates/${data.matchId}/pdf?role=${data.role}&lang=${lang}`;

  // Do not send printable certificate markup to an unapproved mentee.
  if (data.role === 'mentee' && !data.earned) {
    return (
      <section className="mx-auto max-w-4xl space-y-6" data-testid="certificate-locked">
        <header className="space-y-2">
          <Badge variant="outline">{t('statusLocked')}</Badge>
          <h1 className="font-display text-h1 text-ink font-semibold">{t('title')}</h1>
        </header>
        <div className="border-border bg-surface space-y-4 rounded-xl border p-6">
          <ShieldCheck className="text-ink-3 size-10" aria-hidden="true" />
          <h2 className="text-h2 font-semibold">Certificate locked</h2>
          <p className="text-ink-2">
            Your certificate stays locked until an administrator confirms you have passed and
            approves its release. Completing the programme alone does not unlock it.
          </p>
          <ul className="space-y-2 text-sm">
            {requirements.map(([key, complete]) => (
              <li key={key} className="flex items-center gap-2">
                {complete ? (
                  <CheckCircle2 className="text-green size-4" aria-hidden="true" />
                ) : (
                  <Circle className="text-ink-3 size-4" aria-hidden="true" />
                )}
                {t(`requirements.${key}`)}
              </li>
            ))}
            <li>
              {data.adminApproved
                ? 'Administrator permission recorded'
                : 'Awaiting administrator permission'}
            </li>
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <style>{PRINT_CSS}</style>
      <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.earned ? 'default' : 'outline'}>
              {data.earned ? t('statusIssued') : t('statusPreview')}
            </Badge>
            <span className="text-micro text-ink-3 tracking-wide uppercase">
              {data.certificateId}
            </span>
          </div>
          <h1 className="font-display text-h1 text-ink font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-small text-ink-2">
            {data.earned ? t('earnedNote') : t('previewNote')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={`?lang=${lang === 'EN' ? 'FR' : 'EN'}`}>
              <Languages className="mr-2 size-4" />
              {lang === 'EN' ? t('viewFrench') : t('viewEnglish')}
            </Link>
          </Button>
          {data.earned ? (
            <Button asChild type="button" size="sm">
              <a href={`${pdfUrl}&download=1`}>
                <Download className="mr-2 size-4" />
                {t('downloadPdf')}
              </a>
            </Button>
          ) : null}
          <CertificatePrintButton label={t('printPreview')} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] print:block">
        <div className="border-border bg-surface-2 shadow-elevation overflow-x-auto rounded-xl border p-3 sm:p-6 print:overflow-visible print:border-0 print:bg-white print:p-0 print:shadow-none">
          <div className="min-w-[680px] print:min-w-0">
            <CertificateView data={data} lang={lang} />
          </div>
        </div>

        <aside className="space-y-4 print:hidden" aria-label={t('requirementsTitle')}>
          <div className="border-border bg-surface rounded-xl border p-5">
            <div className="flex items-center gap-2">
              <FileCheck2 className="text-green size-5" aria-hidden="true" />
              <h2 className="text-ink font-semibold">{t('requirementsTitle')}</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {requirements.map(([key, complete]) => (
                <li key={key} className="text-small text-ink-2 flex items-start gap-2">
                  {complete ? (
                    <CheckCircle2
                      className="text-green mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle className="text-ink-3 mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{t(`requirements.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-border bg-surface text-small text-ink-2 rounded-xl border p-5">
            <p className="text-ink font-semibold">{t('documentDetails')}</p>
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="text-ink-3">{t('programme')}</dt>
                <dd>{data.programmeName}</dd>
              </div>
              <div>
                <dt className="text-ink-3">{t('cohort')}</dt>
                <dd>{data.cohortName}</dd>
              </div>
              <div>
                <dt className="text-ink-3">{t('language')}</dt>
                <dd>{lang === 'FR' ? t('french') : t('english')}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
