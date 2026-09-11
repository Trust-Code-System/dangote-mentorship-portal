import { describe, expect, it } from 'vitest';
import {
  LOGIN_LIMIT,
  LOGIN_RATE_LIMITED_CODE,
  LOGIN_WINDOW_MS,
  classifyLoginError,
  loginRateLimitKey,
} from '@/lib/auth/login-throttle';

// The bug these cover: a throttled sign-in and a wrong password both surface as
// CredentialsSignin, and the action collapsed both into "Invalid email or
// password". Someone with correct credentials who had just mistyped five times
// was told their password was wrong — the `rate_limited` copy existed in both
// locales and was unreachable.

describe('classifyLoginError', () => {
  it('reports the throttle when the error carries its code', () => {
    expect(classifyLoginError({ code: LOGIN_RATE_LIMITED_CODE })).toBe('rate_limited');
  });

  it('reports invalid credentials for a plain credentials failure', () => {
    expect(classifyLoginError({ code: 'credentials' })).toBe('invalid');
    expect(classifyLoginError(new Error('nope'))).toBe('invalid');
  });

  // Anything unrecognised must fall back to the safe message: a wrong guess can
  // never be distinguishable from an unknown account.
  it('falls back to invalid for anything it does not recognise', () => {
    for (const value of [null, undefined, 'rate_limited', 42, {}, { code: undefined }]) {
      expect(classifyLoginError(value)).toBe('invalid');
    }
  });

  it('does not treat a lookalike code as the throttle', () => {
    expect(classifyLoginError({ code: 'rate_limited_' })).toBe('invalid');
    expect(classifyLoginError({ code: 'RATE_LIMITED' })).toBe('invalid');
  });
});

describe('loginRateLimitKey', () => {
  // IP *and* email: IP alone lets one office lock out a building, email alone
  // lets anyone lock a colleague out by guessing at their address.
  it('combines ip and email', () => {
    expect(loginRateLimitKey('203.0.113.7', 'admin@dangote.com')).toBe(
      'login:203.0.113.7:admin@dangote.com',
    );
  });

  it('lower-cases the email so case cannot buy extra attempts', () => {
    expect(loginRateLimitKey('203.0.113.7', 'Admin@Dangote.COM')).toBe(
      loginRateLimitKey('203.0.113.7', 'admin@dangote.com'),
    );
  });

  it('keeps different accounts on the same ip in separate buckets', () => {
    expect(loginRateLimitKey('203.0.113.7', 'a@x.com')).not.toBe(
      loginRateLimitKey('203.0.113.7', 'b@x.com'),
    );
  });

  it('keeps the same account on different ips in separate buckets', () => {
    expect(loginRateLimitKey('203.0.113.7', 'a@x.com')).not.toBe(
      loginRateLimitKey('198.51.100.2', 'a@x.com'),
    );
  });
});

describe('throttle budget', () => {
  it('is a small number of attempts over a short, fixed window', () => {
    expect(LOGIN_LIMIT).toBe(5);
    expect(LOGIN_WINDOW_MS).toBe(60_000);
  });
});
