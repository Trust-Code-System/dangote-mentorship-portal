import Link from 'next/link';
import { Download, FileBadge2, Languages, RefreshCw, Search } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

function parseSelection(
  value: string | undefined,
): { matchId: string; role: CertificateRole } | null {
  if (!value) return null;
  const [matchId, role] = value.split(':');
  if (!matchId || (role !== 'mentor' && role !== 'mentee')) return null;
  return { matchId, role };
}

function language(value: string | undefined, fallback: CertificateLanguage): CertificateLanguage {
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
        (item) => item.matchId === selection.matchId && item.role === selection.role,
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
        <div className="text-green flex items-center gap-2">
          <FileBadge2 className="size-5" />
          <span className="text-micro font-bold tracking-widest uppercase">{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-h1 text-ink font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-body text-ink-2 max-w-3xl">{t('subtitle')}</p>
      </header>

      <form
        method="get"
        className="border-border bg-surface shadow-elevation grid gap-4 rounded-xl border p-5 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
      >
        <div className="text-small text-ink space-y-2 font-medium">
          <label htmlFor="certificate-participant">{t('participant')}</label>
          <Select name="participant" defaultValue={selectionValue || undefined} required>
            <SelectTrigger id="certificate-participant">
              <SelectValue placeholder={t('selectParticipant')} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((candidate) => (
                <SelectItem
                  key={`${candidate.matchId}:${candidate.role}`}
                  value={`${candidate.matchId}:${candidate.role}`}
                >
                  {candidate.recipientName} ·{' '}
                  {candidate.role === 'mentor' ? t('mentor') : t('mentee')} · {candidate.cohortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-small text-ink space-y-2 font-medium">
          <label htmlFor="certificate-language">{t('language')}</label>
          <Select name="lang" defaultValue={lang}>
            <SelectTrigger id="certificate-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EN">English</SelectItem>
              <SelectItem value="FR">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">
          <Search className="mr-2 size-4" />
          {t('generate')}
        </Button>
      </form>

      {candidates.length === 0 ? (
        <div className="border-border bg-surface text-ink-2 rounded-xl border border-dashed p-8 text-center">
          <FileBadge2 className="text-ink-3 mx-auto size-10" />
          <p className="text-ink mt-3 font-medium">{t('emptyTitle')}</p>
          <p className="text-small mt-1">{t('emptyBody')}</p>
        </div>
      ) : selected ? (
        <>
          <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selected.earned ? 'default' : 'outline'}>
                {selected.earned ? t('eligible') : t('ineligible')}
              </Badge>
              <span className="text-small text-ink font-medium">{selected.recipientName}</span>
              <span className="text-small text-ink-3">
                {selected.programmeName} · {selected.cohortName}
              </span>
              <span className="text-micro text-ink-3 font-mono">{selected.certificateId}</span>
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
              className="border-warning/30 bg-warning/10 text-small text-ink rounded-lg border p-3"
            >
              {t('ineligibleWarning')}
            </p>
          ) : null}

          <div className="border-border bg-surface-2 shadow-elevation overflow-x-auto rounded-xl border p-3 sm:p-7">
            <div className="min-w-[680px]">
              <CertificateView data={selected} lang={lang} />
            </div>
          </div>
        </>
      ) : (
        <div className="border-border bg-surface text-ink-2 rounded-xl border border-dashed p-8 text-center">
          <FileBadge2 className="text-ink-3 mx-auto size-10" />
          <p className="text-ink mt-3 font-medium">{t('selectTitle')}</p>
          <p className="text-small mt-1">{t('selectBody')}</p>
        </div>
      )}
    </section>
  );
}
