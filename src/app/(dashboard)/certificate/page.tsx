import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import { getCertificateData } from '@/features/certificate/data';
import { CertificateView } from '@/features/certificate/certificate-view';
import { CertificatePrintButton } from '@/features/certificate/print-button';

// Completion Certificate page (stakeholder request). Shows the participant's
// branded certificate — official once the journey `completion` step is earned,
// otherwise a clearly-marked PREVIEW so the design is visible before graduation.
// Print stylesheet below isolates the certificate onto a full A4 landscape sheet
// for a clean "Save as PDF".

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  body * { visibility: hidden !important; }
  #certificate, #certificate * { visibility: visible !important; }
  #certificate {
    position: fixed !important; inset: 0 !important;
    width: 100vw !important; max-width: none !important; height: auto !important;
    margin: 0 !important; box-shadow: none !important; border-radius: 0 !important;
  }
}
`;

export default async function CertificatePage() {
  const user = await requireUser();
  const [data, locale, t] = await Promise.all([
    getCertificateData(user.id),
    getLocale(),
    getTranslations('certificate'),
  ]);
  const lang = locale.toLowerCase().startsWith('fr') ? 'FR' : 'EN';

  if (!data) {
    return (
      <section className="space-y-3">
        <h1 className="font-display text-h1 font-bold text-ink">{t('title')}</h1>
        <p className="text-ink-2">{t('noPairing')}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <style>{PRINT_CSS}</style>
      <header className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="space-y-1">
          <h1 className="font-display text-h1 font-bold text-ink">{t('title')}</h1>
          <p className="text-small text-ink-2">{data.earned ? t('earnedNote') : t('previewNote')}</p>
        </div>
        <CertificatePrintButton label={t('download')} />
      </header>

      <div className="rounded-lg bg-surface-2 p-4 shadow-elevation sm:p-8 print:bg-white print:p-0 print:shadow-none">
        <CertificateView data={data} lang={lang} />
      </div>
    </section>
  );
}
