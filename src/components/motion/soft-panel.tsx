import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Keep the panel mounted through its exit. Inert takes effect immediately;
// visibility changes after the fade, so closing never cuts off the animation.
export function SoftPanel({
  open,
  className,
  ...props
}: ComponentProps<'div'> & { open: boolean }) {
  return (
    <div
      {...props}
      inert={!open}
      aria-hidden={!open}
      data-open={open}
      className={cn('soft-panel', className)}
    />
  );
}
