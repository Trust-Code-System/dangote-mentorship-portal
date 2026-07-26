import type { CertificateData, CertificateLanguage } from './data';

const COPY = {
  EN: {
    eyebrow: 'BLAK MOH Mentorship Programme',
    title: 'Certificate of Completion',
    previewTitle: 'Certificate Preview',
    presentedTo: 'This certificate is proudly presented to',
    roleMentee: 'Mentee',
    roleMentor: 'Mentor',
    menteeBody: (programme: string, cohort: string) =>
      `for successfully completing ${programme} (${cohort}) and demonstrating commitment to growth, leadership and measurable development.`,
    mentorBody: (programme: string, cohort: string) =>
      `in recognition of dedicated service as a mentor in ${programme} (${cohort}), guiding emerging leaders with commitment, wisdom and generosity.`,
    completionDate: 'Completion date',
    certificateId: 'Certificate ID',
    programmeDirector: 'Programme Director',
    coordinator: 'Authorized Coordinator',
    preview: 'PREVIEW · NOT YET ISSUED',
    official: 'Official programme certificate',
  },
  FR: {
    eyebrow: 'Programme de mentorat BLAK MOH',
    title: 'Certificat d’achèvement',
    previewTitle: 'Aperçu du certificat',
    presentedTo: 'Ce certificat est fièrement décerné à',
    roleMentee: 'Mentoré(e)',
    roleMentor: 'Mentor',
    menteeBody: (programme: string, cohort: string) =>
      `pour avoir achevé avec succès ${programme} (${cohort}) et fait preuve d’engagement envers sa croissance, son leadership et son développement mesurable.`,
    mentorBody: (programme: string, cohort: string) =>
      `en reconnaissance de son engagement comme mentor dans le cadre de ${programme} (${cohort}) et de son accompagnement généreux et éclairé des leaders émergents.`,
    completionDate: 'Date d’achèvement',
    certificateId: 'Numéro du certificat',
    programmeDirector: 'Direction du programme',
    coordinator: 'Coordination autorisée',
    preview: 'APERÇU · NON ENCORE DÉLIVRÉ',
    official: 'Certificat officiel du programme',
  },
} as const;

const COLOURS = {
  ink: '#17261D',
  forest: '#123F22',
  green: '#1F7338',
  gold: '#A8782E',
  goldSoft: '#D9C18E',
  ivory: '#FCFAF3',
  muted: '#5C695F',
};

function formatCertificateDate(
  value: string,
  lang: CertificateLanguage,
): string {
  return new Intl.DateTimeFormat(lang === 'FR' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function recipientSize(name: string): string {
  if (name.length > 46) return '2.75cqw';
  if (name.length > 32) return '3.2cqw';
  return '3.75cqw';
}

export function CertificateView({
  data,
  lang,
}: {
  data: CertificateData;
  lang: CertificateLanguage;
}) {
  const t = COPY[lang];
  const roleLabel = data.role === 'mentee' ? t.roleMentee : t.roleMentor;
  const body =
    data.role === 'mentee'
      ? t.menteeBody(data.programmeName, data.cohortName)
      : t.mentorBody(data.programmeName, data.cohortName);

  return (
    <article
      id="certificate"
      aria-label={`${data.earned ? t.title : t.previewTitle}: ${data.recipientName}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 1120,
        aspectRatio: '297 / 210',
        margin: '0 auto',
        overflow: 'hidden',
        containerType: 'inline-size',
        color: COLOURS.ink,
        backgroundColor: COLOURS.ivory,
        backgroundImage:
          'radial-gradient(circle at 50% -20%, rgba(31,115,56,.11), transparent 46%), linear-gradient(135deg, rgba(168,120,46,.045) 0 1px, transparent 1px 18px)',
        boxShadow: '0 26px 70px -32px rgba(18,63,34,.55)',
        fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '2.1%',
          border: `2px solid ${COLOURS.forest}`,
          boxShadow: `inset 0 0 0 4px ${COLOURS.ivory}, inset 0 0 0 5px ${COLOURS.goldSoft}`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '3.4%',
          border: `1px solid ${COLOURS.gold}`,
          opacity: 0.72,
        }}
      />

      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(
        (corner) => {
          const top = corner.startsWith('top') ? '2.1%' : undefined;
          const bottom = corner.startsWith('bottom') ? '2.1%' : undefined;
          const left = corner.endsWith('left') ? '2.1%' : undefined;
          const right = corner.endsWith('right') ? '2.1%' : undefined;
          const rotate =
            corner === 'top-right'
              ? 90
              : corner === 'bottom-right'
                ? 180
                : corner === 'bottom-left'
                  ? 270
                  : 0;
          return (
            <div
              key={corner}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top,
                bottom,
                left,
                right,
                width: '7.4cqw',
                height: '7.4cqw',
                transform: `rotate(${rotate}deg)`,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '78%',
                  height: 2,
                  background: COLOURS.gold,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 2,
                  height: '78%',
                  background: COLOURS.green,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '12%',
                  top: '12%',
                  width: '40%',
                  height: 1,
                  background: COLOURS.goldSoft,
                  transform: 'rotate(45deg)',
                  transformOrigin: 'left center',
                }}
              />
            </div>
          );
        },
      )}

      {!data.earned ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '51%',
            transform: 'translate(-50%, -50%) rotate(-21deg)',
            zIndex: 1,
            whiteSpace: 'nowrap',
            color: 'rgba(168,120,46,.14)',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '4.4cqw',
            fontWeight: 800,
            letterSpacing: '.12em',
          }}
        >
          {t.preview}
        </div>
      ) : null}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateRows: 'auto auto auto 1fr auto auto',
          alignItems: 'center',
          justifyItems: 'center',
          height: '100%',
          padding: '5.2% 9.2% 4.3%',
          textAlign: 'center',
        }}
      >
        <header>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/blak-moh-original.png"
            alt="BLAK MOH"
            style={{
              display: 'block',
              width: 'auto',
              height: '7.6cqw',
              maxWidth: '39%',
              margin: '0 auto',
              objectFit: 'contain',
              mixBlendMode: 'multiply',
            }}
          />
          <p
            style={{
              margin: '.55cqw 0 0',
              color: COLOURS.gold,
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '.82cqw',
              fontWeight: 700,
              letterSpacing: '.29em',
              textTransform: 'uppercase',
            }}
          >
            {t.eyebrow}
          </p>
        </header>

        <div style={{ marginTop: '.35cqw' }}>
          <h2
            style={{
              margin: 0,
              color: COLOURS.forest,
              fontSize: '3.05cqw',
              fontWeight: 700,
              letterSpacing: '.015em',
              lineHeight: 1.04,
            }}
          >
            {data.earned ? t.title : t.previewTitle}
          </h2>
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '.75cqw',
              marginTop: '.78cqw',
            }}
          >
            <span
              style={{
                width: '5.5cqw',
                height: 1,
                background: COLOURS.goldSoft,
              }}
            />
            <span
              style={{
                width: '.6cqw',
                height: '.6cqw',
                border: `1px solid ${COLOURS.gold}`,
                transform: 'rotate(45deg)',
              }}
            />
            <span
              style={{
                width: '5.5cqw',
                height: 1,
                background: COLOURS.goldSoft,
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '.55cqw', width: '100%' }}>
          <p
            style={{
              margin: 0,
              color: COLOURS.muted,
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '.88cqw',
              fontWeight: 700,
              letterSpacing: '.15em',
              textTransform: 'uppercase',
            }}
          >
            {t.presentedTo}
          </p>
          <p
            style={{
              margin: '.28cqw auto .2cqw',
              maxWidth: '88%',
              color: COLOURS.ink,
              fontSize: recipientSize(data.recipientName),
              fontWeight: 700,
              lineHeight: 1.04,
              overflowWrap: 'anywhere',
            }}
          >
            {data.recipientName}
          </p>
          <p
            style={{
              margin: 0,
              color: COLOURS.green,
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '.88cqw',
              fontWeight: 800,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
            }}
          >
            {roleLabel}
          </p>
        </div>

        <p
          style={{
            alignSelf: 'center',
            maxWidth: '82%',
            margin: '.7cqw 0 .55cqw',
            color: '#35463A',
            fontSize: '1.22cqw',
            lineHeight: 1.48,
          }}
        >
          {body}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'end',
            width: '100%',
            gap: '4.4cqw',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          <SignatureLine label={t.programmeDirector} />
          <div
            aria-label={t.official}
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '6.4cqw',
              height: '6.4cqw',
              border: `1px solid ${COLOURS.goldSoft}`,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.48)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/blak-moh-mark.png"
              alt=""
              style={{
                width: '66%',
                height: '66%',
                objectFit: 'contain',
                mixBlendMode: 'multiply',
              }}
            />
          </div>
          <SignatureLine label={t.coordinator} />
        </div>

        <footer
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            gap: '2cqw',
            marginTop: '.7cqw',
            color: COLOURS.muted,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '.7cqw',
            letterSpacing: '.055em',
          }}
        >
          <span>
            <strong>{t.completionDate}:</strong>{' '}
            {formatCertificateDate(data.issuedDate, lang)}
          </span>
          <span>
            <strong>{t.certificateId}:</strong> {data.certificateId}
          </span>
        </footer>
      </div>
    </article>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ height: 1, background: COLOURS.ink, opacity: 0.42 }} />
      <div
        style={{
          marginTop: '.45cqw',
          color: COLOURS.muted,
          fontSize: '.72cqw',
          fontWeight: 700,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
}
