import 'server-only';
import { Redis } from '@upstash/redis';
import { aiLimits, AiUsageLimitError, boundedAiRequest } from './limits';
import type { CompleteOptions } from './types';

export const RESERVE_AI_USAGE = `
local tokens = tonumber(redis.call('GET', KEYS[1]) or '0')
local requests = tonumber(redis.call('GET', KEYS[2]) or '0')
if tokens + tonumber(ARGV[1]) > tonumber(ARGV[2]) or requests + 1 > tonumber(ARGV[3]) then return 0 end
redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('INCR', KEYS[2])
redis.call('EXPIREAT', KEYS[1], ARGV[4])
redis.call('EXPIREAT', KEYS[2], ARGV[4])
return 1
`;

export async function reserveAiUsage(options: CompleteOptions): Promise<CompleteOptions> {
  const bounded = boundedAiRequest(options);
  const limits = aiLimits();
  const production =
    process.env.VERCEL_ENV === 'production' || process.env.REQUIRE_PRODUCTION_ENV === 'true';
  if (!limits.monthlyTokens || !limits.monthlyRequests) {
    if (production)
      throw new AiUsageLimitError('The programme AI allowance has not been configured.');
    return bounded.options;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new AiUsageLimitError('AI usage accounting is unavailable.');
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const expires = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000) + 300;
  const scope = process.env.AI_BUDGET_SCOPE?.trim() || 'mentorship-portal';
  try {
    const client = new Redis({ url, token, retry: { retries: 0 } });
    const accepted = await client.eval<number[], number>(
      RESERVE_AI_USAGE,
      [`ai-budget:${scope}:${month}:tokens`, `ai-budget:${scope}:${month}:requests`],
      [bounded.reservedTokens, limits.monthlyTokens, limits.monthlyRequests, expires],
    );
    if (accepted !== 1) throw new AiUsageLimitError('The programme AI allowance has been reached.');
  } catch (error) {
    if (error instanceof AiUsageLimitError) throw error;
    // Spending protection fails closed, unlike the availability-first login limiter.
    throw new AiUsageLimitError('AI usage accounting is temporarily unavailable.');
  }
  // Failed provider attempts retain their reservation; retries cannot overspend.
  return bounded.options;
}
