import { ScrollReveal } from '@/app/(landing)/motion/scroll-reveal';
import { SpotlightCard } from './spotlight-card';
import { cn } from '@/lib/utils';

export interface PublicFeature {
  key: string;
  title: string;
  body: string;
  /** Small monospace-ish tag: what the participant actually sees in the portal. */
  detail?: string;
  icon: React.ReactNode;
}

/**
 * The editorial capability grid (PUBLIC_PAGES_MASTER_SPEC.md §7.1).
 *
 * Deliberately **not** a row of equal cards. One capability is featured across
 * the full width, two sit at medium weight beneath it, and the remainder run as
 * a compact strip — so the layout itself says which things matter most, instead
 * of leaving the reader to weigh seven identical boxes.
 *
 * Every card shares one accent (green). Giving each capability its own bright
 * colour is the fastest way to make a serious product look like a toy, and the
 * old About page's blue/emerald/violet gradients were exactly that.
 */
export function PublicFeatureGrid({
  featured,
  medium,
  compact,
}: {
  featured: PublicFeature;
  medium: PublicFeature[];
  compact: PublicFeature[];
}) {
  return (
    <div className="space-y-5">
      {/* Featured — full width, two columns of its own from `md`. */}
      <ScrollReveal>
        <SpotlightCard className="grid gap-6 p-7 sm:p-9 md:grid-cols-[1fr_1.15fr] md:items-center md:gap-12">
          <div>
            <FeatureIcon size="lg">{featured.icon}</FeatureIcon>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-blak-text sm:text-3xl">
              {featured.title}
            </h3>
          </div>
          <div>
            <p className="max-w-[58ch] text-blak-body text-blak-text-2">{featured.body}</p>
            {featured.detail ? <FeatureDetail>{featured.detail}</FeatureDetail> : null}
          </div>
        </SpotlightCard>
      </ScrollReveal>

      {/* Medium — two halves. */}
      <div className="grid gap-5 md:grid-cols-2">
        {medium.map((feature, index) => (
          <ScrollReveal key={feature.key} delay={index * 0.08}>
            <SpotlightCard className="flex h-full flex-col p-7">
              <FeatureIcon>{feature.icon}</FeatureIcon>
              <h3 className="mt-5 text-lg font-semibold text-blak-text">{feature.title}</h3>
              <p className="mt-3 text-blak-body text-blak-text-2">{feature.body}</p>
              {feature.detail ? <FeatureDetail>{feature.detail}</FeatureDetail> : null}
            </SpotlightCard>
          </ScrollReveal>
        ))}
      </div>

      {/* Compact — a supporting strip, lighter in every dimension. */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {compact.map((feature, index) => (
          <ScrollReveal key={feature.key} delay={index * 0.06}>
            <div className="flex h-full flex-col rounded-2xl border border-blak-border/10 bg-blak-black/25 p-6">
              <FeatureIcon size="sm">{feature.icon}</FeatureIcon>
              <h3 className="mt-4 text-base font-semibold text-blak-text">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-blak-text-2">{feature.body}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}

function FeatureIcon({
  children,
  size = 'md',
}: {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-blak-green/25 bg-blak-green/10 text-blak-green-soft',
        size === 'sm' && 'size-9',
        size === 'md' && 'size-11',
        size === 'lg' && 'size-14',
      )}
    >
      {children}
    </span>
  );
}

function FeatureDetail({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-blak-border/12 px-3.5 py-1.5 text-xs text-blak-text-2">
      <span aria-hidden className="size-1.5 rounded-full bg-blak-green" />
      {children}
    </p>
  );
}
