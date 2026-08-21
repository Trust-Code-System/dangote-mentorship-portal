/**
 * The document Content-Security-Policy.
 *
 * Built per-request in `src/proxy.ts` so `script-src` can carry a nonce. The
 * audit's P1 was that the previous static policy shipped `'unsafe-inline'` on
 * `script-src` with no `'strict-dynamic'` — the token that makes a CSP
 * decorative, because an injected inline script still executes.
 *
 * Two variants, and the difference is deliberate:
 *
 * - **With a nonce** — `'self' 'nonce-…'`. Next stamps the nonce onto the inline
 *   bootstrap and Flight-payload scripts it emits (it reads the nonce off the
 *   request's own CSP header), so an inline script injected by an attacker has
 *   no nonce and is refused. That is the hole this closes. Same-origin
 *   `<script src>` is allowed by `'self'`.
 *
 *   Deliberately **no `'strict-dynamic'`**, though it is the stricter policy on
 *   paper. `'strict-dynamic'` makes browsers ignore `'self'`, so *every* script
 *   element has to carry the nonce — and Turbopack, which is what Vercel builds
 *   with, emits one async chunk without one. (`npm run build` pins `--webpack`
 *   locally and in CI, which nonces all 20 script tags, so this only ever
 *   appeared in production; reproduced locally with `npx next build`.) Under
 *   `'strict-dynamic'` that chunk was blocked on every page load. Dropping it
 *   keeps the real protection and costs only the narrower guarantee that an
 *   injected *same-origin* `<script src>` would also be refused — which needs
 *   an attacker-controlled same-origin JS URL to exploit, and uploads are
 *   served from Supabase, a different origin that `script-src` does not allow.
 *
 * - **Without a nonce** — the previous `'unsafe-inline'` policy. This is the
 *   fail-safe path, not an oversight: if the nonce cannot be threaded into the
 *   render, a nonce-less strict policy would block Next's own inline scripts
 *   and take the whole app down. Degrading to the old policy loses the
 *   hardening but keeps the portal serving. See `src/proxy.ts`.
 *
 * `style-src` keeps `'unsafe-inline'` in both. A nonce cannot be applied to a
 * `style=""` attribute, and the app leans on inline styles heavily — every
 * Framer Motion animation writes them, and the certificate renders almost
 * entirely through them. Dropping it would break visible behaviour to close a
 * markedly lower-severity hole than script injection.
 */

// Supabase Storage + Realtime is the only cross-origin the browser talks to
// directly. Inlined at build time (NEXT_PUBLIC_*), so it is available in the
// edge proxy as well as the server.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseWs = supabaseOrigin.replace(/^https/, 'wss');

// `next dev` compiles with eval-based sourcemaps and HMR, so the dev server
// cannot run without 'unsafe-eval'. Gated on NODE_ENV so it can never reach a
// production response.
const devScriptSrc = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";

export function buildContentSecurityPolicy(nonce?: string): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}'${devScriptSrc}`
    : `script-src 'self' 'unsafe-inline'${devScriptSrc}`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // *.sentry.io is only contacted when NEXT_PUBLIC_SENTRY_DSN is set (client
    // error reporting); harmless otherwise.
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://*.sentry.io`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ]
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim();
}
