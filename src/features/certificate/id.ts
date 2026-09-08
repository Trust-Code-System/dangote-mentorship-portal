import { createHash } from 'node:crypto';

export type CertificateRole = 'mentee' | 'mentor';

/**
 * Stable certificate identity derived from the real accepted match and recipient
 * role. The 80-bit digest is long enough to avoid the collisions possible with
 * the former six-character match suffix, while revealing no participant data.
 */
export function createCertificateId(
  matchId: string,
  role: CertificateRole,
  year: number,
): string {
  const digest = createHash('sha256')
    .update(`blak-moh-certificate:v1:${matchId}:${role}`)
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();

  return `BMOH-${year}-${digest.slice(0, 5)}-${digest.slice(5, 10)}-${digest.slice(10, 15)}-${digest.slice(15)}`;
}
