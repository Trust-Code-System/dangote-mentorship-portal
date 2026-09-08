import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Download,
  FileCheck2,
  Languages,
  ShieldCheck,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import {
  getCertificateData,
  type CertificateLanguage,
} from '@/features/certificate/data';
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

function selectedLanguage(
  value: string | undefined,
  fallback: string,
): CertificateLanguage {
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
          <h1 className="font-display text-h1 font-bold text-ink">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-ink-2">{t('noPairing')}</p>
        </header>
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <ShieldCheck
            className="mx-auto size-10 text-ink-3"
            aria-hidden="true"
          />
          <p className="mt-3 font-medium text-ink">{t('emptyTitle')}</p>
          <p className="mt-1 text-small text-ink-2">{t('emptyBody')}</p>
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

  return (
    <section className="space-y-6">
      <style>{PRINT_CSS}</style>
      <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.earned ? 'default' : 'outline'}>
              {data.earned ? t('statusIssued') : t('statusPreview')}
            </Badge>
            <span className="text-micro uppercase tracking-wide text-ink-3">
              {data.certificateId}
            </span>
          </div>
          <h1 className="font-display text-h1 font-bold text-ink">
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
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-3 shadow-elevation sm:p-6 print:overflow-visible print:border-0 print:bg-white print:p-0 print:shadow-none">
          <div className="min-w-[680px] print:min-w-0">
            <CertificateView data={data} lang={lang} />
          </div>
        </div>

        <aside
          className="space-y-4 print:hidden"
          aria-label={t('requirementsTitle')}
        >
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-green" aria-hidden="true" />
              <h2 className="font-semibold text-ink">
                {t('requirementsTitle')}
              </h2>
            </div>
            <ul className="mt-4 space-y-3">
              {requirements.map(([key, complete]) => (
                <li
                  key={key}
                  className="flex items-start gap-2 text-small text-ink-2"
                >
                  {complete ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-green"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 size-4 shrink-0 text-ink-3"
                      aria-hidden="true"
                    />
                  )}
                  <span>{t(`requirements.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 text-small text-ink-2">
            <p className="font-semibold text-ink">{t('documentDetails')}</p>
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
