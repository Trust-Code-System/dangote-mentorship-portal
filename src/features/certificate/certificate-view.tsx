import type { CertificateData } from './data';

// The visual certificate. Self-contained inline styles so it prints faithfully
// (independent of the app's Tailwind/print cascade). Bilingual copy inline (like
// the agreement templates). Fixed 297×210 (A4 landscape) proportions; the print
// stylesheet in the page fills the sheet and hides the rest of the app.

const COPY = {
  EN: {
    kicker: 'Enterprise Mentorship',
    titleEarned: 'Certificate of Completion',
    titlePreview: 'Certificate of Participation',
    presentedTo: 'This is proudly presented to',
    menteeBody: (p: string) =>
      `for successfully completing the 9-month ${p}, demonstrating growth, commitment, and measurable progress toward their development goals.`,
    mentorBody: (p: string) =>
      `in recognition of dedicated service as a mentor in the ${p}, guiding the next generation of leaders with wisdom and generosity.`,
    cohortLabel: 'Cohort',
    pairedMentee: 'Mentored by',
    pairedMentor: 'Mentor to',
    issued: 'Issued',
    certId: 'Certificate ID',
    dirLead: 'Programme Director',
    dirAdmin: 'Programme Administrator',
    sealTop: 'CERTIFIED',
    sealBottom: 'BLAK MOH',
    preview: 'SAMPLE · PREVIEW',
  },
  FR: {
    kicker: 'Mentorat d’Entreprise',
    titleEarned: 'Certificat de Réussite',
    titlePreview: 'Certificat de Participation',
    presentedTo: 'Est fièrement décerné à',
    menteeBody: (p: string) =>
      `pour avoir mené à bien le ${p} de 9 mois, faisant preuve de progression, d’engagement et de progrès mesurables vers ses objectifs de développement.`,
    mentorBody: (p: string) =>
      `en reconnaissance de son dévouement en tant que mentor du ${p}, guidant la prochaine génération de leaders avec sagesse et générosité.`,
    cohortLabel: 'Cohorte',
    pairedMentee: 'Encadré par',
    pairedMentor: 'Mentor de',
    issued: 'Délivré le',
    certId: 'N° du certificat',
    dirLead: 'Directeur du Programme',
    dirAdmin: 'Administrateur du Programme',
    sealTop: 'CERTIFIÉ',
    sealBottom: 'BLAK MOH',
    preview: 'ÉCHANTILLON · APERÇU',
  },
} as const;

const INK = '#16281d';
const GREEN = '#1F7338';
const GREEN_DEEP = '#123f22';
const GOLD = '#B8860B';
const CREAM = '#FBFAF4';

export function CertificateView({ data, lang }: { data: CertificateData; lang: 'EN' | 'FR' }) {
  const t = COPY[lang];
  const title = data.earned ? t.titleEarned : t.titlePreview;
  const body = data.role === 'mentee' ? t.menteeBody(data.programmeName) : t.mentorBody(data.programmeName);
  const pairedLabel = data.role === 'mentee' ? t.pairedMentee : t.pairedMentor;

  return (
    <div
      id="certificate"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 1000,
        aspectRatio: '297 / 210',
        margin: '0 auto',
        background: `radial-gradient(circle at 50% 0%, #ffffff 0%, ${CREAM} 70%)`,
        color: INK,
        boxShadow: '0 20px 60px -20px rgba(18,63,34,0.35)',
        overflow: 'hidden',
        fontFamily: 'Georgia, "Times New Roman", serif',
        containerType: 'inline-size',
      }}
    >
      {/* Outer + inner decorative frame */}
      <div style={{ position: 'absolute', inset: '2.2%', border: `3px solid ${GREEN}`, borderRadius: 6 }} />
      <div style={{ position: 'absolute', inset: '3.4%', border: `1px solid ${GOLD}`, borderRadius: 4 }} />
      {/* Corner flourishes */}
      {[
        { top: '2.2%', left: '2.2%' },
        { top: '2.2%', right: '2.2%' },
        { bottom: '2.2%', left: '2.2%' },
        { bottom: '2.2%', right: '2.2%' },
      ].map((pos, i) => (
        <div
          key={i}
          style={{ position: 'absolute', width: 26, height: 26, background: GOLD, opacity: 0.9, ...pos, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        />
      ))}

      {data.earned ? null : (
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-24deg)',
            fontSize: '5.5cqw', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(184,134,11,0.13)',
            whiteSpace: 'nowrap', pointerEvents: 'none', fontFamily: 'Arial, sans-serif',
          }}
        >
          {t.preview}
        </div>
      )}

      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center', padding: '6.5% 9% 5.5%' }}>
        {/* Header */}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/blak-moh-mark.png"
            alt=""
            style={{ height: '7cqw', width: 'auto', margin: '0 auto 1cqw', display: 'block' }}
          />
          <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: '2.6cqw', letterSpacing: '0.02em' }}>
            <span style={{ color: INK }}>BLAK </span>
            <span style={{ color: GREEN }}>MOH</span>
            <span style={{ color: GOLD }}>.</span>
          </div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.95cqw', letterSpacing: '0.35em', textTransform: 'uppercase', color: GOLD, marginTop: 2 }}>
            {t.kicker}
          </div>
        </div>

        {/* Title */}
        <div>
          <div style={{ fontSize: '2.9cqw', fontWeight: 700, color: GREEN_DEEP, letterSpacing: '0.01em' }}>{title}</div>
          <div style={{ width: 90, height: 3, background: GOLD, margin: '10px auto 0' }} />
        </div>

        {/* Recipient */}
        <div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.95cqw', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6b7a70' }}>
            {t.presentedTo}
          </div>
          <div style={{ fontSize: '4.2cqw', fontWeight: 700, color: INK, margin: '4px 0 2px', fontStyle: 'italic' }}>
            {data.recipientName}
          </div>
          <div style={{ width: 260, maxWidth: '60%', height: 1, background: GOLD, margin: '2px auto 0' }} />
        </div>

        {/* Body */}
        <p style={{ fontSize: '1.35cqw', lineHeight: 1.5, maxWidth: '80%', color: '#33453a', margin: 0 }}>
          {body}
        </p>

        {/* Meta row */}
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.95cqw', color: '#4a5a50', display: 'flex', gap: '2.5%', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span><b>{t.cohortLabel}:</b> {data.cohortName}</span>
          {data.counterpartName ? <span><b>{pairedLabel}:</b> {data.counterpartName}</span> : null}
          <span><b>{t.issued}:</b> {data.issuedDate}</span>
        </div>

        {/* Signatures + seal */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', fontFamily: 'Arial, sans-serif' }}>
          <Signature label={t.dirLead} />
          <Seal top={t.sealTop} bottom={t.sealBottom} year={data.issuedDate.slice(0, 4)} />
          <Signature label={t.dirAdmin} />
        </div>

        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.75cqw', color: '#8a988f', letterSpacing: '0.05em' }}>
          {COPY[lang].certId}: {data.certificateId}
        </div>
      </div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div style={{ width: '30%', textAlign: 'center' }}>
      <div style={{ height: 1, background: INK, opacity: 0.4 }} />
      <div style={{ fontSize: '0.85cqw', color: '#4a5a50', marginTop: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function Seal({ top, bottom, year }: { top: string; bottom: string; year: string }) {
  return (
    <div style={{ position: 'relative', width: '9cqw', height: '9cqw', maxWidth: 120, maxHeight: 120, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(${GREEN}, ${GREEN_DEEP}, ${GREEN})`, boxShadow: '0 4px 14px -4px rgba(18,63,34,0.5)' }} />
      <div style={{ position: 'absolute', inset: '10%', borderRadius: '50%', border: `1.5px solid ${GOLD}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: '0.8cqw', letterSpacing: '0.16em' }}>{top}</div>
        <div style={{ fontSize: '1.15cqw', fontWeight: 800, letterSpacing: '0.04em', color: '#f6e7bf' }}>{bottom}</div>
        <div style={{ fontSize: '0.75cqw', letterSpacing: '0.1em' }}>{year}</div>
      </div>
    </div>
  );
}
