import * as React from 'react';
import { cn } from '@/lib/utils';

// Textarea (§19 §4) — themed to match Input; carries the bilingual control (§6)
// when composed by the field wrapper.
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'border-input bg-surface text-body text-ink placeholder:text-ink-3 focus-visible:ring-green/30 focus-visible:ring-offset-bg flex min-h-[88px] w-full rounded-md border px-3 py-2 transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
