import 'server-only';
import type { AiAdapter, CompleteOptions } from './types';
import { adapterFromComplete } from './assistant';
import { AI_REQUEST_TIMEOUT_MS, withAiCapacity } from './capacity';

// Anthropic Messages API implementation. Calls the REST API directly to keep
// the dependency surface small; the adapter interface hides this entirely.
// translate/summarize/score come from the shared assistant helper.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

export function createAnthropicAdapter(apiKey: string, model?: string): AiAdapter {
  const activeModel = model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  async function callMessages(options: CompleteOptions): Promise<string> {
    const response = await withAiCapacity(() => fetch(API_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: activeModel,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.2,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: 'user', content: options.prompt }],
      }),
    }));

    if (!response.ok) {
      // Surface status only — never log prompt content (may contain PII, §14).
      throw new Error(`AI provider error (anthropic): HTTP ${response.status}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    return data.content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('')
      .trim();
  }

  return adapterFromComplete(`anthropic:${activeModel}`, callMessages);
}
