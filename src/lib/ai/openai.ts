import 'server-only';
import type { AiAdapter, CompleteOptions } from './types';
import { adapterFromComplete } from './assistant';
import { AI_REQUEST_TIMEOUT_MS, withAiCapacity } from './capacity';

// OpenAI Chat Completions implementation — used as a fallback provider when
// Anthropic is unavailable (CLAUDE.md §2: provider-agnostic adapter, swappable
// without touching feature code). Calls the REST API directly to keep the
// dependency surface small. translate/summarize/score come from the shared
// assistant helper, so behaviour matches the Anthropic adapter exactly.

const API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
}

export function createOpenAiAdapter(apiKey: string, model?: string): AiAdapter {
  const activeModel = model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  async function callChat(options: CompleteOptions): Promise<string> {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    const response = await withAiCapacity(() => fetch(API_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: activeModel,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.2,
        messages,
      }),
    }));

    if (!response.ok) {
      // Surface status only — never log prompt content (may contain PII, §14).
      throw new Error(`AI provider error (openai): HTTP ${response.status}`);
    }

    const data = (await response.json()) as OpenAiResponse;
    return (data.choices?.[0]?.message?.content ?? '').trim();
  }

  return adapterFromComplete(`openai:${activeModel}`, callChat);
}
