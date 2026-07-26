import { getCurrentUser, hasAnyRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import {
  getCertificateForViewer,
  type CertificateLanguage,
  type CertificateRole,
} from '@/features/certificate/data';
import { renderCertificatePdf } from '@/features/certificate/pdf';

export const runtime = 'nodejs';

function certificateRole(value: string | null): CertificateRole | null {
  return value === 'mentor' || value === 'mentee' ? value : null;
}

function certificateLanguage(value: string | null): CertificateLanguage {
  return value?.toUpperCase() === 'FR' ? 'FR' : 'EN';
}

function safeFilename(name: string, lang: CertificateLanguage): string {
  const stem =
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'participant';
  return `BLAK-MOH-certificate-${stem}-${lang.toLowerCase()}.pdf`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const role = certificateRole(url.searchParams.get('role'));
  if (!role) return new Response('Invalid certificate role', { status: 400 });

  const { matchId } = await params;
  const certificate = await getCertificateForViewer(user, matchId, role);
  if (!certificate) return new Response('Not found', { status: 404 });

  const isAdmin = hasAnyRole(user, ADMIN_ROLES);
  const previewRequested = url.searchParams.get('preview') === '1';
  if (!certificate.earned && (!isAdmin || !previewRequested)) {
    return new Response('Certificate completion requirements are not met', {
      status: 409,
    });
  }

  const lang = certificateLanguage(url.searchParams.get('lang'));
  try {
    const bytes = await renderCertificatePdf(certificate, lang);
    const disposition =
      url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${disposition}; filename="${safeFilename(certificate.recipientName, lang)}"`,
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Certificate PDF generation failed', {
      matchId,
      role,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return new Response('Certificate PDF unavailable', { status: 500 });
  }
}
