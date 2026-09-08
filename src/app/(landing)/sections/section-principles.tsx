import { getTranslations } from 'next-intl/server';
import { RevealText } from '../motion/reveal-text';
import { ScrollReveal } from '../motion/scroll-reveal';
import { Counter } from '../motion/counter';

/**
 * Programme figures — every one of them verifiable in this repository:
 *
 *   9 months / 9 stages   the journey rail in the portal and messages/*.json
 *   2 languages           src/i18n/config.ts
 *   6 matching criteria   DEFAULT_WEIGHTS in src/features/matching/engine.ts
 *   6 roles               the RBAC matrix enforced in src/lib/auth
 *   1 unbreakable rule    LANGUAGE_MISMATCH in the matching engine
 *
 * The previous homepage showed "120+ mentors" and "300+ mentees". Those trace
 * to a *planned* cohort size in the project brief, not to live data, so they
 * are deliberately absent here and are logged as an owner decision in
 * LANDING_PAGE_MASTER_SPEC.md §12. Structure is stated instead of participation
 * — which is also the more durable claim between cohorts.
 */
const FACTS = ['months', 'stages', 'languages', 'criteria', 'roles', 'hardRule'] as const;

export async function SectionPrinciples() {
  const t = await getTranslations('landing.principles');

  return (
    <section
      aria-labelledby="principles-heading"
      className="relative overflow-hidden bg-blak-black px-4 py-28 sm:px-6 sm:py-36"
    >
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="max-w-3xl">
          <ScrollReveal>
            <p className="text-blak-label uppercase text-blak-green-soft">{t('eyebrow')}</p>
          </ScrollReveal>
          <h2 id="principles-heading" className="mt-6 text-blak-statement text-blak-text">
            <RevealText text={t('title')} as="span" />
          </h2>
          <ScrollReveal delay={0.1}>
            <p className="mt-7 text-blak-body text-blak-text-2">{t('body')}</p>
          </ScrollReveal>
        </div>

        {/* Large kinetic editorial figures — generous spacing, no stat cards. */}
        <dl className="mt-16 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {FACTS.map((fact, index) => (
            // `ScrollReveal` renders the wrapping <div> itself, so the <dt> and
            // <dd> stay direct children of a single div inside the <dl> — the
            // only nesting a definition list permits. An extra layout div here
            // would make the list invalid.
            //
            // `flex-col-reverse` puts the figure above its label visually while
            // keeping the required dt-before-dd source order, so no aria-hidden
            // duplication is needed to make it read correctly.
            <ScrollReveal
              key={fact}
              delay={Math.min(index * 0.06, 0.3)}
              className="flex flex-col-reverse border-t border-blak-border/12 pt-6"
            >
              <dt className="mt-4 max-w-[18ch] text-blak-body text-blak-text-2">
                {t(`facts.${fact}`)}
              </dt>
              <dd>
                <Counter
                  value={t(`facts.${fact}Value`)}
                  className="block font-serif text-[4.5rem] leading-none text-blak-gold sm:text-[5.5rem]"
                />
              </dd>
            </ScrollReveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
