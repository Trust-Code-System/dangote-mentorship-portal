import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// next-intl is configured WITHOUT i18n routing (locale resolved from a cookie),
// so middleware stays dedicated to auth/RBAC. See src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Supabase origin (Storage + M4 Realtime websockets) must be allowed in
// connect-src; it's the only cross-origin the browser talks to directly.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseWs = supabaseOrigin.replace(/^https/, 'wss');

// Hardened response headers (production-readiness-report.md B1). CSP is a
// pragmatic starting policy: 'unsafe-inline' on script/style is still required
// by Next's inlined runtime + Tailwind; tighten to a nonce-based policy as the
// L3 follow-up. frame-ancestors 'none' + X-Frame-Options block clickjacking;
// HSTS pins TLS; nosniff blocks MIME confusion.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Internal, auth-gated portal: never index it (production-readiness-report.md M5).
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework (production-readiness-report.md M3).
  poweredByHeader: false,
  // Pin the workspace root; an unrelated lockfile higher up the tree would
  // otherwise be inferred as the root.
  outputFileTracingRoot: projectRoot,
  experimental: {
    // Server actions are enabled by default in Next 15; keep body limit explicit
    // for the data-import flows that arrive in M1.
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // Client router cache for dynamic segments (default dynamic=0 forces a full
    // RSC refetch on every sidebar click). AppShell revalidates repeat visits in
    // the background (stale-while-revalidate). Private data stays session-scoped
    // in memory — never localStorage. Auth still runs on hard loads / refresh.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

// Sentry (production-readiness-report.md H2). withSentryConfig configures the
// webpack build so Sentry is bundled correctly per runtime — crucially, it makes
// the EDGE runtime use Sentry's edge-safe build, which is what lets us wire
// edge/client capture without the `EvalError` a hand-rolled edge import causes.
// Source-map upload runs only when SENTRY_AUTH_TOKEN (+ SENTRY_ORG/SENTRY_PROJECT)
// are set; without them the build still succeeds and runtime capture still works.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Strip Sentry's debug logging from the client bundle in production.
  webpack: { treeshake: { removeDebugLogging: true } },
  // No tunnelRoute: the client posts directly to *.sentry.io (allowed in the CSP
  // connect-src above). A tunnel would need a public /monitoring route carved out
  // of the auth middleware — not worth it for an internal portal.
});
