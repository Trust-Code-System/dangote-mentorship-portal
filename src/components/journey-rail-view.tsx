'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { JourneyState } from '@/features/journey/journey';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Journey Rail view (§19 §5) — the signature element. Horizontal on desktop /
// vertical on mobile, 9 nodes on a connecting line that fills green up to the
// current step. State drives appearance; every node deep-links and shows a
// tooltip (name · status · the one action). Load-once fill animation, reduced-
// motion safe. All colour comes from tokens — no raw defaults.

export interface RailNode {
  key: string;
  label: string;
  stateLabel: string;
  state: JourneyState;
  link: string | null;
  isCurrent: boolean;
}

export interface JourneyRailViewProps {
  title: string;
  progressLabel: string;
  openLabel: string;
  nodes: RailNode[];
}

function Node({ node }: { node: RailNode }) {
  const completed = node.state === 'completed';
  const overdue = node.state === 'overdue';
  const needsAction = node.state === 'needs_action';
  const current = node.isCurrent && needsAction;
  const attention = needsAction && !current; // a non-focus "your turn"

  return (
    <span
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-bg transition-colors',
        completed && 'border-green bg-green text-white',
        current && 'border-green text-green',
        attention && 'border-warn text-warn',
        overdue && 'border-risk text-risk',
        node.state === 'pending' && 'border-border text-ink-3',
      )}
    >
      {/* Current-step pulse — replaced by a static heavier ring for reduced motion. */}
      {current && (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full ring-2 ring-green/40 motion-reduce:hidden"
        />
      )}
      {completed ? (
        <Check className="size-4" />
      ) : (
        <span className="size-2 rounded-full bg-current" aria-hidden />
      )}
      {/* needs-action / overdue dot badge */}
      {(attention || overdue) && (
        <span
          aria-hidden
          className={cn(
            'absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-bg',
            overdue ? 'bg-risk' : 'bg-warn',
          )}
        />
      )}
    </span>
  );
}

export function JourneyRailView({
  title,
  progressLabel,
  openLabel,
  nodes,
}: JourneyRailViewProps) {
  const n = nodes.length;
  const currentIndex = nodes.findIndex((x) => x.isCurrent);
  // Fill reaches the current node; if the journey is complete, fill the line.
  const targetFill = currentIndex < 0 ? 100 : n > 1 ? (currentIndex / (n - 1)) * 100 : 0;

  const fill = targetFill;

  function nodeContent(node: RailNode) {
    const tip = (
      <TooltipContent>
        <span className="font-medium">{node.label}</span> · {node.stateLabel}
        {node.link && <span className="text-green-soft"> · {openLabel} →</span>}
      </TooltipContent>
    );
    return { tip };
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-h3">{title}</CardTitle>
          <span className="text-small font-medium tabular-nums text-ink-2">{progressLabel}</span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={150}>
          {/* Desktop: horizontal rail */}
          <div className="relative hidden md:block">
            <div className="absolute left-4 right-4 top-4 h-0.5 -translate-y-1/2 bg-surface-2" aria-hidden />
            <div
              className="absolute left-4 top-4 h-0.5 -translate-y-1/2 rounded-full bg-green transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `calc((100% - 2rem) * ${fill / 100})` }}
              aria-hidden
            />
            <ol className="relative flex justify-between">
              {nodes.map((node) => {
                const { tip } = nodeContent(node);
                return (
                  <li key={node.key} className="flex w-16 flex-col items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {node.link ? (
                          <Link
                            href={node.link}
                            aria-label={`${node.label} — ${node.stateLabel}`}
                            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                          >
                            <Node node={node} />
                          </Link>
                        ) : (
                          <span tabIndex={0} aria-label={`${node.label} — ${node.stateLabel}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30">
                            <Node node={node} />
                          </span>
                        )}
                      </TooltipTrigger>
                      {tip}
                    </Tooltip>
                    <span
                      className={cn(
                        'text-center text-micro leading-tight',
                        node.state === 'completed' || node.isCurrent
                          ? 'font-bold text-green-strong'
                          : node.state === 'pending'
                            ? 'text-ink-3'
                            : 'text-ink-2',
                      )}
                    >
                      {node.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Mobile: vertical rail */}
          <ol className="relative space-y-1 md:hidden">
            {nodes.map((node, i) => (
              <li key={node.key} className="relative flex items-center gap-3">
                {/* vertical connector */}
                {i < n - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-4 top-8 h-[calc(100%-1rem)] w-0.5 -translate-x-1/2',
                      node.state === 'completed' ? 'bg-green' : 'bg-surface-2',
                    )}
                  />
                )}
                {node.link ? (
                  <Link
                    href={node.link}
                    className="flex flex-1 items-center gap-3 rounded-md px-1 py-1.5 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30"
                  >
                    <Node node={node} />
                    <span className="flex flex-1 items-center justify-between gap-2">
                      <span className={cn('text-body', node.state === 'pending' ? 'text-ink-3' : 'text-ink')}>
                        {node.label}
                      </span>
                      <span className="text-small text-ink-2">{node.stateLabel}</span>
                    </span>
                  </Link>
                ) : (
                  <span className="flex flex-1 items-center gap-3 px-1 py-1.5">
                    <Node node={node} />
                    <span className="flex flex-1 items-center justify-between gap-2">
                      <span className={cn('text-body', node.state === 'pending' ? 'text-ink-3' : 'text-ink')}>
                        {node.label}
                      </span>
                      <span className="text-small text-ink-2">{node.stateLabel}</span>
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
