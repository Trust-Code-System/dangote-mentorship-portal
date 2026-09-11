// The login throttle, in one place: the budget, the bucket key, and how a
// throttled attempt is told apart from a wrong password.
//
// Why this file exists. `authorize()` used to `return null` when the rate limit
// tripped, which Auth.js reports as `CredentialsSignin` — byte-for-byte the same
// outcome as a bad password. The sign-in action turned every `AuthError` into
// "Invalid email or password", so a user with *correct* credentials who had just
// mistyped five times was told their password was wrong, with no hint that
// waiting a minute would fix it. The `rate_limited` message existed in both
// locales and was never once reachable.
//
// Auth.js v5 lets `authorize()` throw a `CredentialsSignin` carrying a `code`
// that survives to the caller, so the reason travels with the error instead of
// being inferred. That avoids re-reading the counter in the action, which would
// either consume another slot or need a second, subtly different threshold.
//
// Pure on purpose — no next-auth import, no I/O — so the classifier is unit
// testable without standing up an auth flow.

/** Attempts allowed per window, per IP + email. */
export const LOGIN_LIMIT = 5;

/** Fixed window. It does not slide: the bucket expires this long after the
 *  first attempt, so waiting it out always clears the block. */
export const LOGIN_WINDOW_MS = 60_000;

/**
 * The code carried on a throttled sign-in. It reaches the browser in a query
 * parameter, so it names the *condition* and never whether the email existed or
 * the password was close.
 */
export const LOGIN_RATE_LIMITED_CODE = 'rate_limited';

/**
 * Bucket key for one sign-in attempt.
 *
 * IP *and* email together: keying on IP alone lets one office lock out a whole
 * building, and keying on email alone lets anyone lock a colleague out of their
 * own account by guessing at it.
 */
export function loginRateLimitKey(ip: string, email: string): string {
  return `login:${ip}:${email.toLowerCase()}`;
}

/** What the sign-in form should say about a failed attempt. */
export type LoginErrorReason = 'invalid' | 'rate_limited';

/**
 * Decide which message a failed sign-in deserves.
 *
 * Anything that isn't explicitly the throttle is reported as invalid
 * credentials — the safe default, because a wrong guess must never be
 * distinguishable from an unknown account.
 */
export function classifyLoginError(error: unknown): LoginErrorReason {
  if (typeof error !== 'object' || error === null) return 'invalid';
  const code = (error as { code?: unknown }).code;
  return code === LOGIN_RATE_LIMITED_CODE ? 'rate_limited' : 'invalid';
}
