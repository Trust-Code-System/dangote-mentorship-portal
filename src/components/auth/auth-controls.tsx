'use client';

import { useFormStatus } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Primary submit button for every auth form (AUTH_UI_SPEC.md §3).
 *
 * The loading state is read from `useFormStatus`, so it is driven by the actual
 * form submission rather than by a prop somebody has to remember to pass.
 *
 * Three things it gets right that a plain disabled button does not:
 *  - It **prevents duplicate submissions** — `disabled` while pending, so a
 *    double-click or an impatient second Enter cannot fire the action twice.
 *  - It **announces itself**: the label changes to "Signing in…" and the button
 *    carries `aria-busy`, so a screen reader is told something is happening
 *    instead of hearing silence.
 *  - The width does not change between states, so the layout never jumps.
 */
export function AuthSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        'inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-blak-green text-base font-semibold text-blak-black',
        'shadow-[0_0_0_1px_rgb(var(--blak-green)/0.55),0_12px_28px_-12px_rgb(var(--blak-green)/0.9)]',
        'transition-colors hover:bg-blak-green-soft',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-blak-green/35 focus-visible:ring-offset-2 focus-visible:ring-offset-auth-surface',
        'disabled:cursor-not-allowed disabled:bg-blak-green/70',
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Error / success / info feedback.
 *
 * `role="alert"` for errors so they interrupt and are announced immediately;
 * `role="status"` for success and info so they are announced politely without
 * cutting across whatever the user is doing.
 *
 * The copy passed in is always from the message catalogue — raw provider or
 * database errors are never surfaced here.
 */
export function AuthAlert({
  tone,
  title,
  children,
  className,
}: {
  tone: 'error' | 'success' | 'info';
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;

  const palette = {
    error: 'border-[#B3261E]/30 bg-[#B3261E]/[0.07] text-[#8C1D18]',
    success: 'border-blak-green/35 bg-blak-green/[0.09] text-[#0A5A12]',
    info: 'border-auth-border bg-auth-field text-auth-ink',
  }[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-4', palette, className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {children ? <div className="mt-1 text-sm leading-relaxed opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

/** Labelled rule — "or continue with email". */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-7">
      <div aria-hidden className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-auth-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-auth-surface px-4 text-xs uppercase tracking-wider text-auth-ink-2">
          {label}
        </span>
      </div>
    </div>
  );
}
