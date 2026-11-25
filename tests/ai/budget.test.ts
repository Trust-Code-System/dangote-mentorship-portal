import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundedAiRequest } from '@/lib/ai/limits';
import { reserveAiUsage } from '@/lib/ai/budget';
import { createAnthropicAdapter } from '@/lib/ai/anthropic';

const { evaluate } = vi.hoisted(() => ({ evaluate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@upstash/redis', () => ({
  Redis: class {
    eval = evaluate;
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  evaluate.mockReset();
});

function configured() {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('AI_MONTHLY_TOKEN_BUDGET', '100000');
  vi.stubEnv('AI_MONTHLY_REQUEST_LIMIT', '100');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.company.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-only');
}

describe('AI spending controls', () => {
  it('caps outputs and rejects oversized UTF-8 inputs before sending', () => {
    const env = { AI_MAX_OUTPUT_TOKENS: '128', AI_MAX_INPUT_BYTES: '8' };
    expect(boundedAiRequest({ prompt: 'Hi', maxTokens: 4000 }, env).options.maxTokens).toBe(128);
    expect(() => boundedAiRequest({ prompt: '😀😀😀' }, env)).toThrow('too long');
  });
  it('requires a configured allowance in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('AI_MONTHLY_TOKEN_BUDGET', '');
    vi.stubEnv('AI_MONTHLY_REQUEST_LIMIT', '');
    await expect(reserveAiUsage({ prompt: 'Hi' })).rejects.toThrow('not been configured');
    expect(evaluate).not.toHaveBeenCalled();
  });
  it('blocks outbound provider traffic when the shared allowance is exhausted', async () => {
    configured();
    evaluate.mockResolvedValue(0);
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(createAnthropicAdapter('test-only').complete({ prompt: 'Hi' })).rejects.toThrow(
      'allowance',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fails closed when shared accounting is unavailable', async () => {
    configured();
    evaluate.mockRejectedValue(new Error('network unavailable'));
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(createAnthropicAdapter('test-only').complete({ prompt: 'Hi' })).rejects.toThrow(
      'temporarily unavailable',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reserves the attempt and sends only the bounded response limit', async () => {
    configured();
    vi.stubEnv('AI_MAX_OUTPUT_TOKENS', '128');
    evaluate.mockResolvedValue(1);
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'Result' }] })),
      );
    await expect(
      createAnthropicAdapter('test-only').complete({ prompt: 'Hi', maxTokens: 4000 }),
    ).resolves.toBe('Result');
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string).max_tokens).toBe(128);
    expect(evaluate.mock.calls[0]?.[2]).toEqual([642, 100000, 100, expect.any(Number)]);
  });
});
