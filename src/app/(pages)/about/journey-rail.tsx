'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface JourneyStage {
  key: string;
  title: string;
  body: string;
  fragment: string;
  /** Pre-formatted "Stage 3 of 9". Resolved on the server — a client component
   *  cannot be handed a translator function across the boundary. */
  label: string;
}

/**
 * The nine-month journey (PUBLIC_PAGES_MASTER_SPEC.md §7.1, section 4).
 *
 * A horizontal rail on desktop, a vertical one on mobile, with progress tied to
 * how far the section has travelled through the viewport.
 *
 * What it deliberately does **not** do: pin the section, hijack the scroll, or
 * animate the page horizontally. The landing page already owns a pinned journey
 * chapter; repeating that on a secondary informational page would mean a reader
 * who just wants to know the nine stages has to scroll through nine screens to
 * find them. Here every stage is present in the DOM and readable at all times —
 * the scroll only moves a highlight along the rail.
 *
 * Reduced motion: the progress line is set instantly rather than transitioned,
 * and the highlight still tracks, because knowing where you are is information,
 * not decoration.
 */
export function JourneyRail({
  stages,
  progressLabel,
}: {
  stages: JourneyStage[];
  progressLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      // 0 when the block's top reaches the middle of the viewport, 1 when its
      // bottom does. Clamped, so it never runs away above or below the section.
      const total = rect.height + window.innerHeight * 0.5;
      const travelled = window.innerHeight * 0.75 - rect.top;
      setProgress(Math.min(1, Math.max(0, travelled / total)));
    };

    const onScroll = () => {
      // One rAF per frame at most: a scroll handler that reads layout on every
      // event is the classic way to make a smooth page feel sticky.
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const activeIndex = Math.min(stages.length - 1, Math.floor(progress * stages.length));

  return (
    <div ref={ref} className="mt-16">
      {/* ── Desktop: a horizontal rail with the stages beneath it ── */}
      <div className="hidden lg:block">
        <div
          className="relative h-px w-full bg-blak-border/12"
          role="img"
          aria-label={progressLabel}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blak-green to-blak-gold transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${progress * 100}%` }}
          />
          {stages.map((stage, index) => (
            <span
              key={stage.key}
              aria-hidden
              className={cn(
                'absolute -top-[5px] size-2.5 -translate-x-1/2 rounded-full border transition-colors duration-300',
                index <= activeIndex
                  ? 'border-blak-green bg-blak-green'
                  : 'border-blak-border/25 bg-blak-black',
              )}
              style={{ left: `${(index / (stages.length - 1)) * 100}%` }}
            />
          ))}
        </div>

        {/* Stage names under their own node, so the rail reads as a timeline.
            Decorative: the same names are announced by the list below, and
            repeating nine headings for a screen reader would be noise. */}
        <div aria-hidden className="mt-5 grid grid-cols-9 gap-3">
          {stages.map((stage, index) => (
            <div key={stage.key}>
              <p
                className={cn(
                  'text-[0.7rem] font-semibold uppercase tracking-wider transition-colors duration-300',
                  index <= activeIndex ? 'text-blak-green-soft' : 'text-blak-text-2/60',
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </p>
              <p
                className={cn(
                  'mt-1.5 text-[0.9375rem] font-semibold leading-snug transition-colors duration-300',
                  index <= activeIndex ? 'text-blak-text' : 'text-blak-text-2',
                )}
              >
                {stage.title}
              </p>
            </div>
          ))}
        </div>

        {/* The explanations get their own three-column grid rather than being
            squeezed into 130px timeline columns. Nine columns of prose at
            1440px works out at about ten characters a line — technically a
            timeline, practically unreadable, and well under the 16px floor. */}
        <ol className="mt-14 grid grid-cols-3 gap-x-10 gap-y-9">
          {stages.map((stage, index) => (
            <li
              key={stage.key}
              className={cn(
                'border-t pt-5 transition-colors duration-300',
                index <= activeIndex ? 'border-blak-green/40' : 'border-blak-border/12',
              )}
            >
              <h3 className="flex items-baseline gap-2.5 text-base font-semibold text-blak-text">
                <span
                  aria-hidden
                  className="text-[0.7rem] font-semibold uppercase tracking-wider text-blak-green-soft/70"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {stage.title}
              </h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-blak-text-2">
                {stage.body}
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-blak-border/12 px-3 py-1 text-xs text-blak-text-2">
                <span aria-hidden className="size-1.5 rounded-full bg-blak-green" />
                {stage.fragment}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Mobile / tablet: the same rail, turned vertical ── */}
      <ol className="relative lg:hidden">
        <span aria-hidden className="absolute bottom-0 left-[7px] top-2 w-px bg-blak-border/12" />
        <span
          aria-hidden
          className="absolute left-[7px] top-2 w-px bg-gradient-to-b from-blak-green to-blak-gold transition-[height] duration-300 ease-out motion-reduce:transition-none"
          style={{ height: `calc(${progress * 100}% - 0.5rem)` }}
        />

        {stages.map((stage, index) => (
          <li key={stage.key} className="relative pb-10 pl-9 last:pb-0">
            <span
              aria-hidden
              className={cn(
                'absolute left-0 top-1.5 size-[15px] rounded-full border-2 transition-colors duration-300',
                index <= activeIndex
                  ? 'border-blak-green bg-blak-green/30'
                  : 'border-blak-border/25 bg-blak-black',
              )}
            />
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-blak-green-soft/80">
              {stage.label}
            </p>
            <h3 className="mt-1.5 text-lg font-semibold text-blak-text">{stage.title}</h3>
            <p className="mt-2 max-w-[62ch] text-blak-body text-blak-text-2">{stage.body}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-blak-border/12 px-3 py-1 text-xs text-blak-text-2">
              <span aria-hidden className="size-1.5 rounded-full bg-blak-green" />
              {stage.fragment}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
