import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/**
 * The warm ivory form surface (AUTH_UI_SPEC.md §2).
 *
 * Ivory rather than pure white, so it reads as paper against the cinematic
 * page instead of as a system dialog, and warm rather than cool so it sits with
 * the gold half of the palette. Ink on this surface is 17.4:1.
 */
export function AuthCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('bg-auth-surface py-2', className)}>{children}</div>;
}

/**
 * Card header: the "Enterprise Portal" label, heading and supporting line.
 *
 * The full logo lockup is deliberately not repeated here — it is already
 * prominent in the brand panel on desktop and in the mobile header strip, and
 * repeating it a third time would push the form itself below the fold.
 */
export async function AuthHeader({
  heading,
  supporting,
}: {
  heading: string;
  supporting?: string;
}) {
  const t = await getTranslations('auth');

  return (
    <div className="mb-5">
      <p className="text-auth-ink-2 mb-4 text-[0.75rem] font-medium">{t('enterprisePortal')}</p>

      <h1 className="font-display text-auth-ink text-[2rem] leading-tight font-semibold tracking-tight">
        {heading}
      </h1>
      {supporting ? (
        <p className="text-auth-ink-2 mt-2 text-base leading-relaxed">{supporting}</p>
      ) : null}
    </div>
  );
}
