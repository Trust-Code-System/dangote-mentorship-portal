import { cn } from '@/lib/utils';

/** Compact circular spinner for sidebar pending + header background-refresh. */
export function NavSpinner({
  className,
  label,
}: {
  className?: string;
  /** Accessible name; omit when parent already announces status. */
  label?: string;
}) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      className={cn(
        'inline-block size-3.5 shrink-0 rounded-full border-2 border-green/30 border-t-green-strong',
        'animate-spin motion-reduce:animate-none',
        className,
      )}
    />
  );
}
