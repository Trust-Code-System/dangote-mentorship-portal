import { describe, expect, it } from 'vitest';
import { createCertificateId } from '@/features/certificate/id';

describe('certificate identity', () => {
  it('is stable for the same real match and recipient role', () => {
    expect(createCertificateId('match_accepted_2026', 'mentee', 2026)).toBe(
      createCertificateId('match_accepted_2026', 'mentee', 2026),
    );
  });

  it('separates mentor and mentee certificates from the same match', () => {
    expect(createCertificateId('match_accepted_2026', 'mentor', 2026)).not.toBe(
      createCertificateId('match_accepted_2026', 'mentee', 2026),
    );
  });

  it('does not expose the source match identifier', () => {
    const id = createCertificateId('private-match-cuid-123', 'mentee', 2026);
    expect(id).toMatch(/^BMOH-2026-[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/);
    expect(id).not.toContain('private-match');
  });
});
