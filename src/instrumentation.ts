// Sentry server/edge bootstrap (production-readiness-report.md H2). Next calls
// register() once per runtime; we load the matching Sentry init. Both inits are
// no-ops until SENTRY_DSN is set. withSentryConfig (next.config.mjs) makes the
// edge import resolve to Sentry's edge-safe build, so this no longer trips the
// `EvalError: Code generation from strings disallowed` that a hand-rolled edge
// import caused.
export async function register(): Promise<void> {
  const { assertProductionEnvironment } = await import('./lib/env/production');
  assertProductionEnvironment();

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures errors thrown in server components, route handlers, and server
// actions (Next 15 `onRequestError` hook). No-op when Sentry isn't initialized.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
