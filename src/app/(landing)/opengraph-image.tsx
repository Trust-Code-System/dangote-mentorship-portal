import { ImageResponse } from 'next/og';

/**
 * Social preview card for `/`.
 *
 * Generated rather than committed as a binary so it can never drift from the
 * brand tokens. Colours are the literal values behind `--blak-*` in
 * globals.css — ImageResponse resolves no CSS variables and no Tailwind, so
 * they have to be inlined here; keep them in step with that file.
 *
 * Deliberately English-only: an unfurler fetches this without a session, so
 * there is no locale cookie to read, and a preview card is a single static
 * image rather than user-facing content the portal must mirror in French.
 */
export const alt = 'BLAK MOH — Experience becomes direction';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BLACK = '#000000';
const GREEN = '#14B21F';
const GOLD = '#CD9933';
const TEXT = '#F7F7F7';
const MUTED = '#9AA39B';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BLACK,
          // The hero's green cast, flattened to a single radial so the card
          // reads as the same surface as the page it links to.
          backgroundImage: `radial-gradient(900px 520px at 12% 0%, rgba(20,178,31,0.20), rgba(0,0,0,0) 70%)`,
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: TEXT,
            }}
          >
            BLAK&nbsp;<span style={{ color: GREEN }}>MOH</span>
            <span style={{ color: GOLD }}>.</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              color: TEXT,
              maxWidth: 900,
            }}
          >
            Experience becomes direction
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              lineHeight: 1.4,
              color: MUTED,
              maxWidth: 860,
            }}
          >
            A bilingual, AI-assisted mentorship programme — structured, human-led, nine months.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', width: 56, height: 4, background: GREEN }} />
          <div style={{ display: 'flex', width: 20, height: 4, background: GOLD }} />
        </div>
      </div>
    ),
    size,
  );
}
