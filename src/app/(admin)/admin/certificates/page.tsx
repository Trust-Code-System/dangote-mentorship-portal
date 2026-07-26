import Link from 'next/link';
import {
  Download,
  FileBadge2,
  Languages,
  RefreshCw,
  Search,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import {
  getAdminCertificateCandidates,
  type CertificateLanguage,
  type CertificateRole,
} from '@/features/certificate/data';
import { CertificateView } from '@/features/certificate/certificate-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function parseSelection(
  value: string | undefined,
): { matchId: string; role: CertificateRole } | null {
  if (!value) return null;
  const [matchId, role] = value.split(':');
  if (!matchId || (role !== 'mentor' && role !== 'mentee')) return null;
  return { matchId, role };
}

function language(
  value: string | undefined,
  fallback: CertificateLanguage,
): CertificateLanguage {
  if (value?.toUpperCase() === 'FR') return 'FR';
  if (value?.toUpperCase() === 'EN') return 'EN';
  return fallback;
}

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    participant?: string;
    lang?: string;
    regenerated?: string;
  }>;
}) {
  const admin = await requireRole(ADMIN_ROLES);
  const [params, candidates, t] = await Promise.all([
    searchParams,
    getAdminCertificateCandidates(admin),
    getTranslations('adminCertificates'),
  ]);
  const selection = parseSelection(params.participant);
  const selected = selection
    ? (candidates.find(
        (item) =>
          item.matchId === selection.matchId && item.role === selection.role,
      ) ?? null)
    : null;
  const lang = language(params.lang, selected?.recipientLocale ?? 'EN');
  const selectionValue = selected ? `${selected.matchId}:${selected.role}` : '';
  const pdfUrl = selected
    ? `/api/certificates/${selected.matchId}/pdf?role=${selected.role}&lang=${lang}${selected.earned ? '' : '&preview=1'}`
    : null;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-green">
          <FileBadge2 className="size-5" />
          <span className="text-micro font-bold uppercase tracking-widest">
            {t('eyebrow')}
          </span>
        </div>
        <h1 className="font-display text-h1 text-ink">{t('title')}</h1>
        <p className="max-w-3xl text-body text-ink-2">{t('subtitle')}</p>
      </header>

      <form
        method="get"
        className="grid gap-4 rounded-xl border border-border bg-surface p-5 shadow-elevation sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
      >
        <label className="space-y-2 text-small font-medium text-ink">
          <span>{t('participant')}</span>
          <select
            name="participant"
            defaultValue={selectionValue}
            required
            className="h-11 w-full rounded-md border border-border bg-white px-3 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            <option value="">{t('selectParticipant')}</option>
            {candidates.map((candidate) => (
              <option
                key={`${candidate.matchId}:${candidate.role}`}
                value={`${candidate.matchId}:${candidate.role}`}
              >
                {candidate.recipientName} ·{' '}
                {candidate.role === 'mentor' ? t('mentor') : t('mentee')} ·{' '}
                {candidate.cohortName}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-small font-medium text-ink">
          <span>{t('language')}</span>
          <select
            name="lang"
            defaultValue={lang}
            className="h-11 w-full rounded-md border border-border bg-white px-3 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            <option value="EN">English</option>
            <option value="FR">Français</option>
          </select>
        </label>
        <Button type="submit">
          <Search className="mr-2 size-4" />
          {t('generate')}
        </Button>
      </form>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-ink-2">
          <FileBadge2 className="mx-auto size-10 text-ink-3" />
          <p className="mt-3 font-medium text-ink">{t('emptyTitle')}</p>
          <p className="mt-1 text-small">{t('emptyBody')}</p>
        </div>
      ) : selected ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selected.earned ? 'default' : 'outline'}>
                {selected.earned ? t('eligible') : t('ineligible')}
              </Badge>
              <span className="text-small font-medium text-ink">
                {selected.recipientName}
              </span>
              <span className="text-small text-ink-3">
                {selected.programmeName} · {selected.cohortName}
              </span>
              <span className="font-mono text-micro text-ink-3">
                {selected.certificateId}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`?participant=${encodeURIComponent(selectionValue)}&lang=${lang === 'EN' ? 'FR' : 'EN'}`}
                >
                  <Languages className="mr-2 size-4" />
                  {lang === 'EN' ? 'Français' : 'English'}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`?participant=${encodeURIComponent(selectionValue)}&lang=${lang}&regenerated=1`}
                >
                  <RefreshCw className="mr-2 size-4" />
                  {t('regenerate')}
                </Link>
              </Button>
              {pdfUrl ? (
                <Button asChild size="sm">
                  <a href={`${pdfUrl}&download=1`}>
                    <Download className="mr-2 size-4" />
                    {selected.earned ? t('downloadPdf') : t('downloadPreview')}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          {params.regenerated === '1' ? (
            <p role="status" className="text-small text-green">
              {t('regeneratedStatus')}
            </p>
          ) : null}
          {!selected.earned ? (
            <p
              role="alert"
              className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-small text-ink"
            >
              {t('ineligibleWarning')}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-3 shadow-elevation sm:p-7">
            <div className="min-w-[680px]">
              <CertificateView data={selected} lang={lang} />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-ink-2">
          <FileBadge2 className="mx-auto size-10 text-ink-3" />
          <p className="mt-3 font-medium text-ink">{t('selectTitle')}</p>
          <p className="mt-1 text-small">{t('selectBody')}</p>
        </div>
      )}
    </section>
  );
}
