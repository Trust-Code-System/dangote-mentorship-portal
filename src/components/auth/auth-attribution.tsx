import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/**
 * Who built and who delivers the programme, as a colophon under the brand
 * lockup on the authentication screens.
 *
 * Dangote is the programme; BLAK MOH builds the portal; Kennedia Consulting
 * delivers it with them. That reads as attribution rather than co-branding,
 * which is why the Dangote mark above it stays visually dominant and these two
 * sit small and quiet beneath.
 *
 * Both partner assets are reversed (light-on-transparent), so this only belongs
 * on a dark surface — the brand panel on desktop, and the dark strip below the
 * card on mobile. It replaced the old auth footer, which carried a trust note,
 * three links and a copyright line.
 */
export async function AuthAttribution({ className }: { className?: string }) {
  const t = await getTranslations('auth');

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-blak-text-2',
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        {t('poweredBy')}
        <Image
          src="/brand/blak-moh-mark.png"
          alt="BLAK MOH"
          width={914}
          height={914}
          className="h-5 w-auto object-contain"
        />
        <span className="font-display text-[0.8rem] font-extrabold normal-case tracking-tight text-blak-text">
          BLAK <span className="text-blak-green">MOH</span>
        </span>
      </span>

      <span className="inline-flex items-center gap-2">
        {t('inPartnershipWith')}
        <Image
          src="/brand/kennedia-consulting-logo.png"
          alt="Kennedia Consulting"
          width={320}
          height={91}
          className="h-5 w-auto max-w-[9rem] object-contain"
        />
      </span>
    </div>
  );
}
