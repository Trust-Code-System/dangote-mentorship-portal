import type { CompleteOptions } from './types';

export class AiUsageLimitError extends Error {}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function aiLimits(env: Readonly<Record<string, string | undefined>> = process.env) {
  return {
    maxOutputTokens: Math.min(8192, positive(env.AI_MAX_OUTPUT_TOKENS, 4096)),
    maxInputBytes: Math.min(200_000, positive(env.AI_MAX_INPUT_BYTES, 60_000)),
    monthlyTokens: positive(env.AI_MONTHLY_TOKEN_BUDGET, 0),
    monthlyRequests: positive(env.AI_MONTHLY_REQUEST_LIMIT, 0),
  };
}

export function boundedAiRequest(
  options: CompleteOptions,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const limits = aiLimits(env);
  const inputBytes = new TextEncoder().encode(`${options.system ?? ''}${options.prompt}`).length;
  if (inputBytes > limits.maxInputBytes) throw new AiUsageLimitError('The AI request is too long.');
  const requested = options.maxTokens ?? 1024;
  if (!Number.isSafeInteger(requested) || requested < 1)
    throw new AiUsageLimitError('Invalid AI response limit.');
  const maxTokens = Math.min(requested, limits.maxOutputTokens);
  // Conservative reservation, not a currency conversion or billed-token report.
  return { options: { ...options, maxTokens }, reservedTokens: inputBytes + maxTokens + 512 };
}
