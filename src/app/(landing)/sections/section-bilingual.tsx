import { getTranslations } from 'next-intl/server';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';

/**
 * The bilingual chapter.
 *
 * The path splits into two equally weighted routes — English and Français —
 * and rejoins at the same destination. Both columns get identical width,
 * identical treatment and identical prominence; neither is styled as the
 * original and neither as the translation.
 *
 * The sample is **real interface copy** lifted from the application's own
 * message files (`goals.subtitle` in en.json and fr.json), so the comparison is
 * honest rather than a marketing paraphrase. It stays in both languages
 * regardless of the page locale, because the point of the section is that both
 * exist — the surrounding copy is what follows the locale.
 */
export async function SectionBilingual() {
  const t = await getTranslations('landing.bilingual');

  const points = ['interface', 'content', 'matching'] as const;

  return (
    <section
      aria-labelledby="bilingual-heading"
      className="relative overflow-hidden bg-blak-black px-4 py-28 sm:px-6 sm:py-36"
    >
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="max-w-3xl">
          <ScrollReveal>
            <p className="text-blak-label uppercase text-blak-green-soft">{t('eyebrow')}</p>
          </ScrollReveal>
          <h2 id="bilingual-heading" className="mt-6 text-blak-statement text-blak-text">
            <RevealText text={t('title')} as="span" className="block" />
            <RevealText
              text={t('titleAccent')}
              delay={0.12}
              as="span"
              className="block font-serif font-normal italic text-blak-gold"
            />
          </h2>
          <ScrollReveal delay={0.1}>
            <p className="mt-7 text-blak-body text-blak-text-2">{t('body')}</p>
          </ScrollReveal>
        </div>

        {/* ── Two paths, equal weight ── */}
        <ScrollReveal delay={0.05} className="mt-16">
          <p className="text-blak-label uppercase text-blak-text-2">{t('sampleLabel')}</p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <LanguagePath code="en" label={t('enLabel')} sample={t('sampleEn')} tone="green" />
            <LanguagePath code="fr" label={t('frLabel')} sample={t('sampleFr')} tone="gold" />
          </div>

          {/* The paths rejoin. */}
          <div className="mt-8 flex flex-col items-center">
            <svg aria-hidden viewBox="0 0 240 48" className="h-12 w-60">
              <path
                d="M20 2 C 20 34, 120 20, 120 46"
                fill="none"
                stroke="rgb(var(--blak-green))"
                strokeOpacity="0.5"
                strokeWidth="1.5"
              />
              <path
                d="M220 2 C 220 34, 120 20, 120 46"
                fill="none"
                stroke="rgb(var(--blak-gold))"
                strokeOpacity="0.5"
                strokeWidth="1.5"
              />
              <circle cx="120" cy="46" r="3" fill="rgb(var(--blak-ivory))" />
            </svg>
            <p className="mt-2 text-center font-serif text-xl italic text-blak-text sm:text-2xl">
              {t('sameDestination')}
            </p>
          </div>
        </ScrollReveal>

        {/* ── The three guarantees ── */}
        <div className="mt-20 grid gap-8 border-t border-blak-border/10 pt-12 md:grid-cols-3 md:gap-10">
          {points.map((point, index) => (
            <ScrollReveal key={point} delay={index * 0.08}>
              <h3 className="text-lg font-semibold text-blak-text">{t(`points.${point}`)}</h3>
              <p className="mt-3 text-blak-body text-blak-text-2">{t(`points.${point}Body`)}</p>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.1}>
          <p className="mt-10 text-sm text-blak-text-2/80">{t('switchHint')}</p>
        </ScrollReveal>
      </div>
    </section>
  );
}

function LanguagePath({
  code,
  label,
  sample,
  tone,
}: {
  code: 'en' | 'fr';
  label: string;
  sample: string;
  tone: 'green' | 'gold';
}) {
  const accent = tone === 'green' ? 'text-blak-green-soft' : 'text-blak-gold';
  const border = tone === 'green' ? 'border-blak-green/25' : 'border-blak-gold/25';

  return (
    <div className={`rounded-2xl border ${border} bg-blak-forest/50 p-6 sm:p-8`}>
      <p className={`text-blak-label uppercase ${accent}`}>{label}</p>
      {/* `lang` is set explicitly so screen readers and hyphenation switch
          voice/rules correctly for the sample, whatever the page locale is. */}
      <p lang={code} className="mt-4 text-blak-body text-blak-text">
        {sample}
      </p>
    </div>
  );
}
