'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import { getAiAdapter } from '@/lib/ai';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { ok, fail, mapActionError, type ActionResult } from '@/lib/actions/result';

// Atlas — the portal's AI copilot (CLAUDE.md §9: all AI server-side, advisory
// only, keys never reach the client). Atlas answers questions about using the
// portal, drafts text, summarizes, and coaches on mentoring. It NEVER performs
// actions or reads confidential content (messages/notes) — it tells the user
// where to click. All eight AI assistants stay human-gated; Atlas is a
// read/advisory guide, not a writer.

export interface AtlasMessage {
  role: 'user' | 'assistant';
  content: string;
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
const askSchema = z.object({
  // Most recent turns; capped so the prompt stays bounded.
  history: z.array(messageSchema).min(1).max(20),
});

// How Atlas can help (kept terse so the grounding prompt stays small). These are
// real portal destinations so Atlas can point users to the right screen.
const PORTAL_MAP = `Key destinations: Dashboard (role home); Profile; My Mentor / My Mentee; Goals (set + AI Goal Coach, mentee submits, mentor approves); Session logs (mentor logs, AI summary); Meetings/Calendar (schedule); Mid-Term & Final Review; Clinics; Forum; Messages; Notifications; Support. Admins also have: Cohorts, Import data, Matching engine, Forms builder, Mentors/Mentees lists (click a name for full profile + progress), Training, Reports/AI Insights, User management, Audit logs.`;

function buildSystem(userName: string, roles: string, lang: 'EN' | 'FR'): string {
  return [
    `You are Atlas, the AI copilot built into the Dangote Mentorship Programme — a 9-month bilingual (English/French) mentorship programme.`,
    `The current user is ${userName} (role: ${roles}).`,
    `Help them use the portal and succeed at mentoring: explain features and where to find them, draft text (goals, session notes, agendas, messages, newsletters), summarize, and suggest next steps.`,
    `You are ADVISORY ONLY — you cannot take actions, change data, approve matches/goals, or send anything. When a task needs an action, tell the user exactly where to click to do it themselves.`,
    `Never invent confidential information about specific people, and never claim to read private messages, notes, or reflections. If asked for data you don't have, point them to the screen where they can see it.`,
    `Be concise, warm, and practical. Use short paragraphs or bullet points. Respond in ${lang === 'FR' ? 'French' : 'English'}.`,
    PORTAL_MAP,
  ].join('\n\n');
}

function renderConversation(history: AtlasMessage[]): string {
  const lines = history.map((m) => `${m.role === 'user' ? 'User' : 'Atlas'}: ${m.content}`);
  // Cue the model to produce the next Atlas turn.
  return `${lines.join('\n\n')}\n\nAtlas:`;
}

export async function askAtlas(input: {
  history: AtlasMessage[];
}): Promise<ActionResult<{ reply: string }>> {
  try {
    const user = await requireUser();
    const { history } = askSchema.parse(input);

    // Rate-limit the AI endpoint per user (CLAUDE.md §14): 20 messages/minute.
    const limit = await checkRateLimit(`atlas:${user.id}`, 20, 60_000);
    if (!limit.ok) {
      const t = await getTranslations('copilot');
      return fail({ code: 'CONFLICT', message: t('rateLimited') });
    }

    const ai = getAiAdapter();
    if (!ai.enabled) {
      const t = await getTranslations('copilot');
      return ok({ reply: t('disabledReply') });
    }

    const lang = user.locale === 'FR' ? 'FR' : 'EN';
    const roles = user.roles.join(', ') || 'participant';
    const reply = await ai.complete({
      system: buildSystem(user.name ?? user.email, roles, lang),
      prompt: renderConversation(history),
      maxTokens: 700,
      temperature: 0.4,
    });

    const trimmed = reply.trim();
    if (!trimmed) {
      const t = await getTranslations('copilot');
      return ok({ reply: t('emptyReply') });
    }
    return ok({ reply: trimmed });
  } catch (error) {
    return mapActionError(error);
  }
}
