import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Flat enterprise buttons for the authenticated portal (internal performance
// pass). Solid fills, thin borders, 150ms colour transitions — no gradient,
// glow, multi-layer shadow, scale, or bounce. 44px default touch target and
// visible green focus ring retained (§19 §4, a11y).
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-colors duration-150 motion-reduce:transition-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    // Disabled: readable ink on muted surface — do not rely on opacity alone.
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface-2 disabled:text-ink-3 disabled:shadow-none disabled:opacity-100',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'border border-green-strong bg-green text-white hover:bg-green-strong hover:border-green-strong active:translate-y-px',
        secondary:
          'border border-border bg-surface text-ink hover:bg-surface-2 hover:text-green-strong',
        outline:
          'border border-border bg-surface text-ink hover:bg-surface-2',
        ghost: 'border border-transparent text-ink hover:bg-green-soft/60 hover:text-green-strong',
        destructive:
          'border border-risk bg-risk text-white hover:bg-risk/90 active:translate-y-px',
        link: 'border border-transparent text-green underline-offset-4 hover:underline disabled:border-transparent disabled:bg-transparent',
      },
      size: {
        default: 'h-11 px-5 text-body', // 44px touch target (§4)
        sm: 'h-9 px-3 text-small',
        lg: 'h-12 px-7 text-h3',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
