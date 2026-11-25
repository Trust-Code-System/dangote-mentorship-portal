import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/**
 * Who delivers the programme, as two separately-placed credits on the
 * authentication screens.
 *
 * They used to sit together directly under the brand lockup, which put three
 * competing marks in the top-left corner. Split instead: Kennedia sits with the
 * body copy it belongs to, and BLAK MOH sits in the panel footer where a build
 * credit conventionally goes. Dangote alone owns the top of the panel.
 *
 * Both are light-on-transparent, so they only belong on a dark surface — the
 * brand panel on desktop, and the dark strip below the card on mobile.
 */

/** "In collaboration with · [Kennedia Consulting]" — sits under the body copy. */
export async function CollaborationCredit({
  className,
  onLight = false,
}: {
  className?: string;
  onLight?: boolean;
}) {
  const t = await getTranslations('auth');

  return (
    <div
      className={cn(
        'text-blak-text-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.6rem] font-semibold tracking-[0.14em] uppercase',
        className,
      )}
    >
      {t('inCollaborationWith')}
      <Image
        src="/brand/kennedia-consulting-logo.png"
        alt="Kennedia Consulting"
        width={320}
        height={91}
        className={cn(
          'h-5 w-auto max-w-[9.5rem] object-contain',
          onLight && 'bg-ink h-8 rounded-md px-2 py-1',
        )}
      />
    </div>
  );
}

/**
 * "Powered by BLAK MOH" — the build credit, in the panel footer.
 *
 * Wordmark only: the BLAK MOH brand *mark* was removed at the owner's request
 * so the Dangote logo is the single mark on the screen.
 */
export async function PoweredByCredit({ className }: { className?: string }) {
  const t = await getTranslations('auth');

  return (
    <div
      className={cn(
        'text-blak-text-2 flex flex-wrap items-center gap-x-2 text-[0.6rem] font-semibold tracking-[0.14em] uppercase',
        className,
      )}
    >
      {t('poweredBy')}
      <span className="font-display text-blak-text text-[0.8rem] font-extrabold tracking-tight normal-case">
        BLAK <span className="text-blak-green">MOH</span>
      </span>
    </div>
  );
}
