import NextAuth from 'next-auth';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import authConfig from '@/lib/auth/auth.config';
import { buildContentSecurityPolicy } from '@/lib/security/csp';

// Next 16 renamed the `middleware` file convention to `proxy`; this is the same
// edge entry point under the new name. Route gating runs from the edge-safe
// config (no Prisma). Per-action RBAC is still enforced server-side via
// requireRole() (CLAUDE.md §3, §4).
// Calling `.auth(request, event)` is the exact path `export default ....auth`
// already took as the proxy entry point: at runtime it hits the
// `args[0] instanceof Request` branch and returns a Response. The published
// overloads omit that shape (they type a two-arg call as the pages-router
// `(NextApiRequest, NextApiResponse) => Session`), so the call is narrowed
// here. Deliberately NOT the `.auth((req) => …)` wrapper form: passing a
// middleware function makes next-auth skip its own `!authorized` branch, which
// is what issues the redirect to /login — the whole route gate would silently
// stop gating.
const authProxy = NextAuth(authConfig).auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<Response>;

/**
 * Base64 nonce. Must match the shape Next looks for when it scans the request's
 * CSP header: /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/.
 */
function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Auth gating, plus a per-request nonce for the document CSP.
 *
 * The nonce has to reach the renderer on the **request**: Next reads
 * `content-security-policy` off the incoming headers and stamps the nonce it
 * finds onto its own inline scripts. The only way to rewrite request headers
 * from here is `NextResponse.next({ request: { headers } })`, and Auth.js
 * builds its own pass-through response — so on the allow path we discard its
 * response and construct our own, carrying over the cookies it set.
 *
 * The authorization decision itself is untouched: it stays entirely in
 * `authConfig.callbacks.authorized`, and anything that is not a clean
 * pass-through (a redirect to /login, most importantly) is returned exactly as
 * Auth.js produced it.
 */
export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await authProxy(request, event);

  // `NextResponse.next()` marks itself with x-middleware-next. Treat anything
  // else — redirects above all — as a decision Auth.js has already made, and
  // pass it straight through untouched apart from the header.
  const isPassThrough =
    response.status === 200 && response.headers.get('x-middleware-next') === '1';

  if (!isPassThrough) {
    // No document is rendered for these, so there is no inline script to nonce.
    // The nonce-less policy is also the fail-safe if this detection ever stops
    // matching: it is the previous working policy, so the app keeps serving.
    response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());
    return response;
  }

  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  // x-nonce is not read by Next; it is here so a server component can reach the
  // nonce via headers() if one ever needs to render a script tag itself.
  requestHeaders.set('x-nonce', nonce);
  // A server layout cannot see the requested path. The assessment gate needs it
  // to know whether a locked mentee is already on an allowed route (otherwise
  // redirecting to /assessment would loop). Set here, read via headers().
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('Content-Security-Policy', csp);

  const passThrough = NextResponse.next({ request: { headers: requestHeaders } });

  // Auth.js appends rotated session cookies to its own response. Rebuilding the
  // pass-through would drop them and silently sign people out mid-session.
  for (const cookie of response.headers.getSetCookie()) {
    passThrough.headers.append('set-cookie', cookie);
  }
  passThrough.headers.set('Content-Security-Policy', csp);

  return passThrough;
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
