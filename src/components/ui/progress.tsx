'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

// ProgressBar (§19 §4) — "progress bars over numbers" (§3). Surface-2 track,
// green fill. `tone` switches the fill to a status color when the bar reports
// health rather than completion. Reduced-motion safe (width transition only).
const toneClass = {
  green: 'bg-green',
  ok: 'bg-ok',
  warn: 'bg-warn',
  risk: 'bg-risk',
} as const;

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  tone?: keyof typeof toneClass;
}

const Progress = React.forwardRef<React.ComponentRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, tone = 'green', ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn('bg-surface-2 relative h-2 w-full overflow-hidden rounded-full', className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 rounded-full transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none',
          toneClass[tone],
        )}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  ),
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
