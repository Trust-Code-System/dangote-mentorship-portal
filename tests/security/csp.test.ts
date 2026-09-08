import { describe, expect, it, vi, afterEach } from 'vitest';

// The whole point of the nonce policy is that script-src stops trusting inline
// script. These lock that in, so a future edit cannot quietly put
// 'unsafe-inline' back on script-src and re-open the hole.

async function loadCsp(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', nodeEnv);
  const mod = await import('@/lib/security/csp');
  return mod.buildContentSecurityPolicy;
}

/** Pull one directive out of the serialized policy. */
function directive(policy: string, name: string): string {
  const found = policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return found ?? '';
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('buildContentSecurityPolicy', () => {
  it('uses the nonce and never unsafe-inline on script-src', async () => {
    const build = await loadCsp('production');
    const scriptSrc = directive(build('abc123=='), 'script-src');

    expect(scriptSrc).toContain("'nonce-abc123=='");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('never adds strict-dynamic, which would block Turbopack’s un-nonced chunk', async () => {
    // 'strict-dynamic' makes browsers ignore 'self', so every script element
    // must carry the nonce. Turbopack — Vercel's bundler — emits one async
    // chunk without one, and it was blocked on every production page load.
    const build = await loadCsp('production');
    expect(build('abc123==')).not.toContain("'strict-dynamic'");
    expect(build()).not.toContain("'strict-dynamic'");
  });

  it('still allows same-origin script elements via self', async () => {
    const build = await loadCsp('production');
    expect(directive(build('abc123=='), 'script-src')).toContain("'self'");
  });

  it('falls back to the previous unsafe-inline policy when no nonce is available', async () => {
    const build = await loadCsp('production');
    const scriptSrc = directive(build(), 'script-src');

    // Deliberate: a nonce-less strict policy would block Next's own inline
    // scripts and take the app down. See src/proxy.ts.
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it('never ships unsafe-eval in production', async () => {
    const build = await loadCsp('production');
    expect(build('n0nce')).not.toContain("'unsafe-eval'");
    expect(build()).not.toContain("'unsafe-eval'");
  });

  it('allows unsafe-eval outside production so the dev server can run', async () => {
    const build = await loadCsp('development');
    expect(directive(build('n0nce'), 'script-src')).toContain("'unsafe-eval'");
  });

  it('keeps style-src permissive — a nonce cannot cover style attributes', async () => {
    const build = await loadCsp('production');
    // Framer Motion and the certificate render through inline style attributes;
    // dropping this breaks visible behaviour to close a far smaller hole.
    expect(directive(build('n0nce'), 'style-src')).toContain("'unsafe-inline'");
  });

  it('keeps the clickjacking and injection baseline in both variants', async () => {
    const build = await loadCsp('production');
    for (const policy of [build('n0nce'), build()]) {
      expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'");
      expect(directive(policy, 'object-src')).toBe("object-src 'none'");
      expect(directive(policy, 'base-uri')).toBe("base-uri 'self'");
      expect(directive(policy, 'form-action')).toBe("form-action 'self'");
      expect(directive(policy, 'default-src')).toBe("default-src 'self'");
    }
  });
});
