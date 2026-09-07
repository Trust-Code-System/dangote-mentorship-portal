import { reportContentSchema, type ReportBlock, type ReportContent } from './schema';

// AI report formatter (CLAUDE.md §9). The assistant does two things and only
// two things to a built report:
//
//   1. corrects spelling/grammar and tightens the wording of narrative text;
//   2. adds **bold** emphasis to the figures and phrases that carry the point.
//
// It must NOT invent content, change numbers, or touch table data — a report
// that quietly disagrees with the portal is worse than an unpolished one. The
// prompt says so and `mergePolishedNarrative` enforces it structurally: only
// the narrative blocks it returned are merged back, everything else is kept
// exactly as built, and the block count and order cannot change.
//
// The polished version is a *suggestion*: nothing is written until the author
// accepts it (§0 rule 5).

/** Blocks the assistant is allowed to rewrite. */
const NARRATIVE_KINDS = new Set<ReportBlock['kind']>(['heading', 'paragraph', 'bullets']);

export interface NarrativeItem {
  index: number;
  kind: 'heading' | 'paragraph' | 'bullets';
  /** One string for heading/paragraph, one per bullet for bullets. */
  text: string[];
}

/** Extract the rewritable narrative, keyed by block index. */
export function extractNarrative(content: ReportContent): NarrativeItem[] {
  const items: NarrativeItem[] = [];
  content.blocks.forEach((block, index) => {
    if (!NARRATIVE_KINDS.has(block.kind)) return;
    if (block.kind === 'heading') items.push({ index, kind: 'heading', text: [block.text] });
    if (block.kind === 'paragraph') items.push({ index, kind: 'paragraph', text: [block.text] });
    if (block.kind === 'bullets') items.push({ index, kind: 'bullets', text: block.items });
  });
  return items;
}

export function buildPolishPrompt(
  content: ReportContent,
  narrative: NarrativeItem[],
  lang: 'EN' | 'FR',
): { system: string; prompt: string } {
  const system = [
    'You are an editor preparing an internal mentorship-programme report for senior management.',
    lang === 'FR' ? 'Write in French.' : 'Write in English.',
    'Do exactly two things to each item of text you are given:',
    '1. Fix spelling, grammar and punctuation, and tighten clumsy phrasing. Keep the meaning identical.',
    '2. Wrap the words that carry the point in **double asterisks** to bold them — figures, names of competencies, and outcome words. Bold sparingly: at most a few words per sentence.',
    'Hard rules: never invent facts, never change a number, a date or a name, never add or remove items, never add commentary.',
    'Return ONLY a JSON array, one object per item you were given, in the same order:',
    '[{"index": <number>, "text": ["…"]}]',
    'Each object\'s "text" array must have exactly as many strings as the item you were given.',
  ].join(' ');

  const payload = narrative.map((item) => ({
    index: item.index,
    kind: item.kind,
    text: item.text,
  }));

  const prompt = [
    `Report title context: ${content.subtitle ?? 'internal mentorship report'}`,
    '',
    'Items to edit:',
    JSON.stringify(payload, null, 2),
  ].join('\n');

  return { system, prompt };
}

interface PolishedItem {
  index: number;
  text: string[];
}

/**
 * Parse the assistant's reply. Tolerant of fenced code blocks and prose around
 * the JSON, because a model that wraps its answer should not lose the whole
 * polish pass. Returns [] when nothing usable came back — the caller then keeps
 * the unpolished report, which is always a safe outcome.
 */
export function parsePolishResponse(raw: string): PolishedItem[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const items: PolishedItem[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const index = typeof record.index === 'number' ? record.index : Number(record.index);
    if (!Number.isInteger(index) || index < 0) continue;

    const text = Array.isArray(record.text)
      ? record.text.filter((t): t is string => typeof t === 'string')
      : typeof record.text === 'string'
        ? [record.text]
        : [];
    if (text.length === 0) continue;

    items.push({ index, text });
  }
  return items;
}

/**
 * Merge polished narrative back into the built report.
 *
 * Structural guarantees (this is where "AI cannot change the facts" is
 * enforced, not merely requested):
 *   - only blocks that were offered for rewriting can change;
 *   - a bullets block must come back with the same number of bullets, or it is
 *     rejected wholesale — a shortened list would silently drop findings;
 *   - blank replacements are ignored;
 *   - table, KPI and every other block is copied through untouched.
 */
export function mergePolishedNarrative(
  content: ReportContent,
  narrative: NarrativeItem[],
  polished: PolishedItem[],
): ReportContent {
  const offered = new Map(narrative.map((item) => [item.index, item]));
  const byIndex = new Map(polished.map((item) => [item.index, item]));

  const blocks = content.blocks.map((block, index): ReportBlock => {
    const item = offered.get(index);
    const replacement = byIndex.get(index);
    if (!item || !replacement || item.kind !== block.kind) return block;

    if (block.kind === 'heading' || block.kind === 'paragraph') {
      const text = replacement.text[0]?.trim();
      if (!text) return block;
      return { ...block, text };
    }

    if (block.kind === 'bullets') {
      if (replacement.text.length !== block.items.length) return block;
      const items = replacement.text.map((text, i) => text.trim() || block.items[i]!);
      return { ...block, items };
    }

    return block;
  });

  // Re-validate: the merged document must still satisfy the content contract
  // (length limits included). If it doesn't, keep the original.
  const result = reportContentSchema.safeParse({ ...content, blocks });
  return result.success ? result.data : content;
}
