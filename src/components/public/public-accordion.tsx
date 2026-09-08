'use client';

import { useEffect, useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItemModel {
  /** Stable slug — becomes the element id and the deep-link fragment. */
  id: string;
  question: string;
  answer: string;
  /** Optional short label shown beside the question (e.g. its category). */
  meta?: string;
}

/**
 * An accessible disclosure list (PUBLIC_PAGES_MASTER_SPEC.md §7.2).
 *
 * Notes on the parts that are easy to get wrong:
 *
 *  - **It is a real button.** `<button aria-expanded aria-controls>` inside the
 *    heading, so a screen reader announces "collapsed/expanded" and the whole
 *    row is operable with Enter and Space for free. No `role="button"` div.
 *  - **The animation is `grid-template-rows: 0fr → 1fr`**, not a measured pixel
 *    height. It needs no layout read, no ResizeObserver, and it cannot clip a
 *    longer French answer — which is exactly what a fixed `max-height` does.
 *  - **Closed panels are `inert`.** Keeping the answer in the DOM is what makes
 *    browser find-in-page and deep links work; `inert` is what stops a keyboard
 *    user tabbing into a link inside a collapsed panel.
 *  - **State is not colour.** The indicator rotates from + to ×, the question
 *    brightens, and `aria-expanded` carries the truth.
 *  - **Multiple items may be open.** People comparing two answers should not
 *    have to keep reopening the first one.
 */
export function PublicAccordion({
  items,
  className,
  tone = 'dark',
}: {
  items: AccordionItemModel[];
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  // Deep link: /faq#q-<id> opens that answer and brings it into view. Runs on
  // hash changes too, so clicking a link to another question from inside an
  // answer behaves the same as arriving with the fragment already set.
  useEffect(() => {
    function openFromHash() {
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;
      const target = items.find((item) => `q-${item.id}` === hash);
      if (!target) return;
      setOpen((current) => new Set(current).add(target.id));
      // The heading needs to exist and be expanded before scrolling to it; one
      // frame is enough and avoids landing on a still-collapsed row.
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ block: 'start' });
      });
    }

    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [items]);

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className={cn('divide-y', tone === 'light' ? 'divide-blak-forest/12' : 'divide-blak-border/10', className)}>
      {items.map((item) => (
        <AccordionRow
          key={item.id}
          item={item}
          tone={tone}
          expanded={open.has(item.id)}
          onToggle={() => toggle(item.id)}
        />
      ))}
    </div>
  );
}

function AccordionRow({
  item,
  expanded,
  onToggle,
  tone,
}: {
  item: AccordionItemModel;
  expanded: boolean;
  onToggle: () => void;
  tone: 'dark' | 'light';
}) {
  const panelId = useId();
  const light = tone === 'light';

  return (
    <div id={`q-${item.id}`} className="scroll-mt-28">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={cn(
            'flex w-full items-start justify-between gap-5 py-6 text-left transition-colors',
            light
              ? expanded
                ? 'text-blak-forest'
                : 'text-blak-forest-2/85 hover:text-blak-forest'
              : expanded
                ? 'text-blak-text'
                : 'text-blak-text-2 hover:text-blak-text',
          )}
        >
          <span className="min-w-0">
            <span className="block text-base font-semibold leading-snug sm:text-lg">
              {item.question}
            </span>
            {item.meta ? (
              <span
                className={cn(
                  'mt-1.5 block text-xs uppercase tracking-wider',
                  light ? 'text-blak-green-deep' : 'text-blak-green-soft/80',
                )}
              >
                {item.meta}
              </span>
            ) : null}
          </span>

          <span
            aria-hidden
            className={cn(
              'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-transform duration-300',
              light ? 'border-blak-forest/20' : 'border-blak-border/20',
              expanded && 'rotate-45',
            )}
          >
            <Plus className="size-4" />
          </span>
        </button>
      </h3>

      {/* 0fr → 1fr: animates to the answer's natural height without measuring
          it, so nothing is ever clipped. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div
            id={panelId}
            inert={!expanded}
            className={cn(
              'max-w-[68ch] pb-7 pr-10 text-blak-body',
              light ? 'text-blak-forest-2/85' : 'text-blak-text-2',
            )}
          >
            {item.answer}
          </div>
        </div>
      </div>
    </div>
  );
}
