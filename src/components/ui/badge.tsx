import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Pill / Badge (§19 §4) — status variants. Micro uppercase type (§2), pill
// radius. Status colors are functional only: green=ok, amber=warn, red=risk,
// blue=info, gold=recognition. `neutral`/`outline` carry non-status labels.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-green text-white',
        neutral: 'border-transparent bg-surface-2 text-ink-2',
        ok: 'border-transparent bg-green-soft text-green-strong',
        warn: 'border-transparent bg-warn/15 text-warn',
        risk: 'border-transparent bg-risk/15 text-risk',
        info: 'border-transparent bg-info/15 text-info',
        gold: 'border-transparent bg-gold/15 text-gold',
        outline: 'border-border text-ink-2',
        // Back-compat aliases for existing screens.
        secondary: 'border-transparent bg-surface-2 text-ink-2',
        destructive: 'border-transparent bg-risk text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
