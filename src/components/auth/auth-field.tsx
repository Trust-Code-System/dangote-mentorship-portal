'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The shared authentication input (AUTH_UI_SPEC.md §3).
 *
 * Deliberate choices:
 *  - **The label is always visible**, above the field. No floating labels and no
 *    placeholder-as-label — both fail the moment a browser autofills the field
 *    or a user zooms in.
 *  - **56px tall**, comfortably above the 44px touch floor, with 16px text so
 *    iOS never zooms the viewport on focus.
 *  - Errors are wired with `aria-describedby` + `aria-invalid`, so a screen
 *    reader hears the message as part of the field rather than as loose text.
 *  - The field fill is one step warmer than the card, which keeps the input
 *    legible **when the browser autofills it** — a pure-white field on a white
 *    card disappears under Chrome's autofill tint.
 */
export function AuthField({
  id,
  name,
  label,
  type = 'text',
  autoComplete,
  required,
  defaultValue,
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  inputMode,
  error,
  hint,
  trailing,
  className,
  minLength,
}: {
  id?: string;
  name?: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  /** Controlled value — use when the field must survive a failed submission. */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  inputMode?: 'text' | 'email' | 'numeric';
  error?: string;
  hint?: string;
  /** Rendered to the right of the label — e.g. the "Forgot?" link. */
  trailing?: React.ReactNode;
  className?: string;
  minLength?: number;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-sm font-semibold text-auth-ink">
          {label}
        </label>
        {trailing}
      </div>

      <input
        id={fieldId}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={onChange ? undefined : defaultValue}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        inputMode={inputMode}
        minLength={minLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'h-14 w-full rounded-xl border bg-auth-field px-4 text-base text-auth-ink transition-colors',
          'placeholder:text-auth-ink-2/60',
          'focus:outline-none focus-visible:border-blak-green focus-visible:ring-4 focus-visible:ring-blak-green/25',
          'disabled:cursor-not-allowed disabled:opacity-70 read-only:text-auth-ink-2',
          error ? 'border-[#B3261E] ring-2 ring-[#B3261E]/20' : 'border-auth-border',
        )}
      />

      {hint ? (
        <p id={hintId} className="mt-2 text-sm text-auth-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-sm font-medium text-[#B3261E]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * `AuthField` plus a show/hide toggle and a Caps Lock warning.
 *
 * The toggle is a real `<button>` with an accessible name that changes with
 * state, sized to 44px, and placed **outside** the input's padding so it never
 * covers typed characters. Paste is not blocked and `autoComplete` is passed
 * through untouched, so password managers work normally.
 */
export function PasswordField({
  id,
  name = 'password',
  label,
  autoComplete = 'current-password',
  required = true,
  error,
  hint,
  trailing,
  className,
  minLength,
}: {
  id?: string;
  name?: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
  className?: string;
  minLength?: number;
}) {
  const t = useTranslations('auth');
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const capsId = `${fieldId}-caps`;

  const [visible, setVisible] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const describedBy = [error ? errorId : null, hint ? hintId : null, capsOn ? capsId : null]
    .filter(Boolean)
    .join(' ');

  function trackCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    // `getModifierState` is unavailable on some synthetic events; guard it.
    if (typeof event.getModifierState !== 'function') return;
    setCapsOn(event.getModifierState('CapsLock'));
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-sm font-semibold text-auth-ink">
          {label}
        </label>
        {trailing}
      </div>

      <div className="relative">
        <input
          id={fieldId}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          onKeyUp={trackCapsLock}
          onKeyDown={trackCapsLock}
          onBlur={() => setCapsOn(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'h-14 w-full rounded-xl border bg-auth-field pl-4 pr-14 text-base text-auth-ink transition-colors',
            'focus:outline-none focus-visible:border-blak-green focus-visible:ring-4 focus-visible:ring-blak-green/25',
            error ? 'border-[#B3261E] ring-2 ring-[#B3261E]/20' : 'border-auth-border',
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-auth-ink-2 transition-colors hover:text-auth-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-blak-green/25"
        >
          <span className="sr-only">{visible ? t('hidePassword') : t('showPassword')}</span>
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>

      {capsOn ? (
        <p id={capsId} role="status" className="mt-2 text-sm text-[#8A5A00]">
          {t('capsLock')}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-2 text-sm text-auth-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-sm font-medium text-[#B3261E]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
