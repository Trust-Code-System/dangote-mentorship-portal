import Image from 'next/image';
import { Wordmark } from '@/components/wordmark';
import { cn } from '@/lib/utils';

// The Dangote brand mark, served as a transparent PNG from public/brand.
//
// The supplied asset is the **reversed (white) logo**: its opaque pixels average
// 233/255 luminance, so it reads on a dark surface and disappears on a light
// one. That is why there are two components rather than one — the portal shows
// this mark on both. If a dark-ink Dangote logo is ever supplied, `BrandPlate`
// collapses to a plain `BrandMark` and the tile goes away.
//
// The source is 103×55, so never render it much taller than ~55px or it softens;
// the splash screens use h-11/h-12 for exactly that reason. Sizing is by height
// (`h-9 w-auto`) rather than `size-*`, because the logo is 1.87:1 — a square box
// would letterbox it to half height.

const DANGOTE = { src: '/brand/dangote-logo.png', width: 103, height: 55 } as const;

/** The bare reversed mark. Use on dark surfaces only. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={DANGOTE.src}
      alt="Dangote"
      width={DANGOTE.width}
      height={DANGOTE.height}
      className={cn('h-9 w-auto shrink-0 object-contain', className)}
    />
  );
}

/**
 * The same mark on the programme's dark tile, for light surfaces — the app
 * shell sidebar, the splash screens, the maintenance page.
 *
 * A deliberate lockup rather than a workaround for an invisible logo: the tile
 * uses the portal's own forest tone, so it reads as part of the product instead
 * of a foreign navy block. `className` sizes the tile; the mark scales inside it.
 */
export function BrandPlate({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-blak-forest px-1.5 py-1',
        className,
      )}
    >
      <Image
        src={DANGOTE.src}
        alt="Dangote"
        width={DANGOTE.width}
        height={DANGOTE.height}
        className="h-full w-auto object-contain"
      />
    </span>
  );
}

export function BrandLogo({
  name,
  className,
  markClassName,
  wordmarkClassName,
  accentClassName,
}: {
  name: string;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  accentClassName?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark className={markClassName} />
      <Wordmark
        name={name}
        className={cn('truncate font-display text-h3 font-bold', wordmarkClassName)}
        accentClassName={accentClassName}
      />
    </span>
  );
}
