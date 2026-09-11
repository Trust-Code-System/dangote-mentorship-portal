import 'server-only';
import { Redis } from '@upstash/redis';
import { applyFixedWindow, rateLimit, type RateLimitResult } from './rate-limit';

// Cross-instance rate limiting (production-readiness-report.md H1). The pure
// in-memory `rateLimit()` is per-process, so on serverless (many lambdas) it
// barely throttles brute-force. When Upstash REST credentials are present this
// wrapper uses a shared, atomic INCR + expiry bucket instead; otherwise it falls
// back to the in-memory limiter (correct for single-instance / on-prem).
//
// Activate by setting UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/**
 * Records one hit against `key` and reports whether it is within `limit` hits
 * per `windowMs`, using a shared store when configured. Always async so call
 * sites don't change when the backing store does. Fails OPEN: if the shared
 * store is unreachable, it allows the request (availability over strictness)
 * rather than locking everyone out — auth flows still have other defenses.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) return rateLimit(key, limit, windowMs);

  const windowSeconds = Math.ceil(windowMs / 1000);
  try {
    return await applyFixedWindow(client, key, limit, windowSeconds);
  } catch {
    // Shared store down — degrade to the local limiter rather than failing auth.
    return rateLimit(key, limit, windowMs);
  }
}
