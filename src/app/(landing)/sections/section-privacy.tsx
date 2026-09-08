import { getTranslations } from 'next-intl/server';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';

const PRINCIPLES = ['approval', 'private', 'roles'] as const;

/**
 * Privacy and human control — calm and authoritative, no padlock imagery and no
 * claimed certifications (none are held, and the brief forbids inventing any).
 *
 * Each principle carries its own abstract diagram instead of an icon: an
 * approval point standing outside the connection, a message sealed inside a
 * translucent enclosure, and concentric access rings. The copy is drawn from
 * the model the application actually enforces.
 */
export async function SectionPrivacy() {
  const t = await getTranslations('landing.privacy');

  const diagrams = {
    approval: <ApprovalDiagram />,
    private: <EnclosureDiagram />,
    roles: <AccessRingsDiagram />,
  } as const;

  return (
    <section
      aria-labelledby="privacy-heading"
      className="relative overflow-hidden bg-blak-forest px-4 py-28 sm:px-6 sm:py-36"
    >
      <div className="relative mx-auto w-full max-w-[1280px]">
        <div className="max-w-3xl">
          <ScrollReveal>
            <p className="text-blak-label uppercase text-blak-green-soft">{t('eyebrow')}</p>
          </ScrollReveal>
          <h2 id="privacy-heading" className="mt-6 text-blak-statement text-blak-text">
            <RevealText text={t('title')} as="span" className="block" />
            <RevealText
              text={t('titleAccent')}
              delay={0.12}
              as="span"
              className="block font-serif font-normal italic text-blak-text-2"
            />
          </h2>
          <ScrollReveal delay={0.1}>
            <p className="mt-7 text-blak-body text-blak-text-2">{t('body')}</p>
          </ScrollReveal>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {PRINCIPLES.map((principle, index) => (
            <ScrollReveal key={principle} delay={index * 0.08}>
              <div className="flex h-full flex-col rounded-2xl border border-blak-border/12 bg-blak-black/40 p-6 sm:p-7">
                <div className="mb-6">{diagrams[principle]}</div>
                <h3 className="text-lg font-semibold text-blak-text">
                  {t(`items.${principle}.title`)}
                </h3>
                <p className="mt-3 text-blak-body text-blak-text-2">
                  {t(`items.${principle}.body`)}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.1}>
          <p className="mt-12 max-w-3xl border-l-2 border-blak-gold/40 pl-5 text-sm leading-relaxed text-blak-text-2">
            {t('note')}
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

/** An approval point sitting outside the connection, not on it. */
function ApprovalDiagram() {
  return (
    <svg aria-hidden viewBox="0 0 160 80" className="h-20 w-40">
      <line x1="18" y1="58" x2="142" y2="58" stroke="rgb(var(--blak-green))" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="18" cy="58" r="5" fill="rgb(var(--blak-gold))" />
      <circle cx="142" cy="58" r="5" fill="rgb(var(--blak-green-soft))" />
      {/* The approver: above the line, connected by a dashed check, never on the
          connection itself. */}
      <line x1="80" y1="58" x2="80" y2="26" stroke="rgb(var(--blak-ivory))" strokeOpacity="0.3" strokeDasharray="3 3" />
      <circle cx="80" cy="20" r="9" fill="none" stroke="rgb(var(--blak-ivory))" strokeOpacity="0.55" />
      <path d="M76 20 l3 3.5 l6 -7" fill="none" stroke="rgb(var(--blak-green-soft))" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** A message sealed inside a translucent enclosure. */
function EnclosureDiagram() {
  return (
    <svg aria-hidden viewBox="0 0 160 80" className="h-20 w-40">
      <rect x="34" y="14" width="92" height="52" rx="14" fill="rgb(var(--blak-green))" fillOpacity="0.07" stroke="rgb(var(--blak-green))" strokeOpacity="0.35" />
      <rect x="52" y="30" width="56" height="20" rx="6" fill="rgb(var(--blak-ivory))" fillOpacity="0.12" />
      <line x1="60" y1="37" x2="100" y2="37" stroke="rgb(var(--blak-ivory))" strokeOpacity="0.45" strokeWidth="1.5" />
      <line x1="60" y1="43" x2="86" y2="43" stroke="rgb(var(--blak-ivory))" strokeOpacity="0.3" strokeWidth="1.5" />
      {/* Outside, looking in: metadata only. */}
      <circle cx="14" cy="40" r="5" fill="none" stroke="rgb(var(--blak-text-2))" strokeOpacity="0.5" />
      <line x1="20" y1="40" x2="30" y2="40" stroke="rgb(var(--blak-text-2))" strokeOpacity="0.3" strokeDasharray="2 3" />
    </svg>
  );
}

/** Concentric access rings — six roles, each with its own boundary. */
function AccessRingsDiagram() {
  return (
    <svg aria-hidden viewBox="0 0 160 80" className="h-20 w-40">
      <circle cx="80" cy="40" r="30" fill="none" stroke="rgb(var(--blak-ivory))" strokeOpacity="0.14" />
      <circle cx="80" cy="40" r="21" fill="none" stroke="rgb(var(--blak-gold))" strokeOpacity="0.35" />
      <circle cx="80" cy="40" r="12" fill="none" stroke="rgb(var(--blak-green))" strokeOpacity="0.55" />
      <circle cx="80" cy="40" r="4" fill="rgb(var(--blak-green-soft))" />
      {/* Role markers on their own rings. */}
      <circle cx="110" cy="40" r="3" fill="rgb(var(--blak-ivory))" fillOpacity="0.4" />
      <circle cx="80" cy="19" r="3" fill="rgb(var(--blak-gold))" fillOpacity="0.7" />
      <circle cx="68" cy="40" r="2.5" fill="rgb(var(--blak-green-soft))" />
    </svg>
  );
}
