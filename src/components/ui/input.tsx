import * as React from 'react';
import { cn } from '@/lib/utils';

// Input (§19 §4): 8px radius, 44px height (touch), green focus ring, body type.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-input bg-surface text-body text-ink placeholder:text-ink-3 file:text-small focus-visible:ring-green/30 focus-visible:ring-offset-bg flex h-11 w-full rounded-md border px-3 py-2 transition-[border-color,box-shadow] duration-150 file:border-0 file:bg-transparent file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
