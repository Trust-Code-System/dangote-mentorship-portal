import 'server-only';
import { createAnthropicAdapter } from './anthropic';
import { createOpenAiAdapter } from './openai';
import type { AiAdapter, AiScore } from './types';

export type { AiAdapter, AiLanguage, AiScore } from './types';

// When no provider key is configured, AI features degrade gracefully: every
// assistant is advisory by design (CLAUDE.md §9), so an empty suggestion is
// always a safe result. Callers check `adapter.enabled` to hide AI UI.
const disabledAdapter: AiAdapter = {
  id: 'disabled',
  enabled: false,
  async complete(): Promise<string> {
    return '';
  },
  async translate(): Promise<string> {
    return '';
  },
  async summarize(): Promise<string> {
    return '';
  },
  async score(): Promise<AiScore> {
    return { score: 0, reasoning: 'AI is not configured.' };
  },
};

// Wraps a primary adapter with a fallback: every call tries the primary first
// and, if it THROWS (network/HTTP error — e.g. a bad key, an unavailable model,
// or a regional block), retries the same call on the fallback. score() never
// throws (it catches parse errors internally), so a primary that merely returns
// garbage won't trigger the fallback — only a transport-level failure does.
function withFallback(primary: AiAdapter, fallback: AiAdapter): AiAdapter {
  async function tryBoth<T>(
    op: (a: AiAdapter) => Promise<T>,
    label: string,
  ): Promise<T> {
    try {
      return await op(primary);
    } catch (primaryError) {
      // Status only — never log prompt content (may contain PII, §14).
      console.warn(
        `AI primary (${primary.id}) failed on ${label}; falling back to ${fallback.id}.`,
        primaryError instanceof Error ? primaryError.message : primaryError,
      );
      return op(fallback);
    }
  }

  return {
    id: `${primary.id}+fallback:${fallback.id}`,
    enabled: true,
    complete: (options) => tryBoth((a) => a.complete(options), 'complete'),
    translate: (options) => tryBoth((a) => a.translate(options), 'translate'),
    summarize: (options) => tryBoth((a) => a.summarize(options), 'summarize'),
    score: (options) => tryBoth((a) => a.score(options), 'score'),
  };
}

let cached: AiAdapter | null = null;

function aiFeaturesEnabled(): boolean {
  const value = process.env.AI_FEATURES_ENABLED?.trim().toLowerCase();
  return value !== 'false' && value !== '0' && value !== 'off';
}

// Provider selection (CLAUDE.md §2 — provider-agnostic). Anthropic is primary;
// OpenAI is the fallback when its key is set. With only one key configured that
// provider is used directly; with neither, AI degrades gracefully (disabled).
export function getAiAdapter(): AiAdapter {
  if (cached) return cached;

  // Operational kill switch: pause every assistant without deleting or rotating
  // provider credentials. The existing disabled adapter keeps manual fallbacks
  // available and prevents outbound AI requests.
  if (!aiFeaturesEnabled()) {
    cached = disabledAdapter;
    return cached;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const anthropic = anthropicKey ? createAnthropicAdapter(anthropicKey) : null;
  const openai = openaiKey ? createOpenAiAdapter(openaiKey) : null;

  if (anthropic && openai) {
    cached = withFallback(anthropic, openai);
  } else {
    cached = anthropic ?? openai ?? disabledAdapter;
  }
  return cached;
}
