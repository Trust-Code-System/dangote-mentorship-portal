import { describe, expect, it } from 'vitest';
import {
  extractNarrative,
  mergePolishedNarrative,
  parsePolishResponse,
} from '@/features/reports/assistant';
import type { ReportContent } from '@/features/reports/schema';

// The AI polish pass is the one place AI text enters a document a human will
// send to management, so the merge guarantees ("AI cannot change the facts")
// are asserted here rather than trusted to the prompt.

const content: ReportContent = {
  subtitle: 'Programme to date',
  blocks: [
    { kind: 'kpis', items: [{ label: 'Goals set', value: '4' }] },
    { kind: 'heading', level: 2, text: 'developement goals' },
    { kind: 'paragraph', text: 'the mentee has done well this quarter' },
    { kind: 'bullets', items: ['met 4 times', 'finished 2 goals'] },
    {
      kind: 'table',
      caption: 'Goals',
      columns: ['Goal', 'Status'],
      rows: [['Lead the review', 'Approved']],
    },
  ],
};

describe('extractNarrative', () => {
  it('offers only heading, paragraph and bullet blocks', () => {
    const narrative = extractNarrative(content);
    expect(narrative.map((item) => item.kind)).toEqual(['heading', 'paragraph', 'bullets']);
  });

  it('keeps the original block index so the merge can line up', () => {
    const narrative = extractNarrative(content);
    expect(narrative.map((item) => item.index)).toEqual([1, 2, 3]);
  });

  it('offers each bullet as its own string', () => {
    const bullets = extractNarrative(content).find((item) => item.kind === 'bullets');
    expect(bullets?.text).toEqual(['met 4 times', 'finished 2 goals']);
  });
});

describe('parsePolishResponse', () => {
  it('parses a clean JSON array', () => {
    expect(parsePolishResponse('[{"index":2,"text":["Fixed."]}]')).toEqual([
      { index: 2, text: ['Fixed.'] },
    ]);
  });

  it('finds the array inside a fenced code block with prose around it', () => {
    const raw = 'Sure, here you go:\n```json\n[{"index":1,"text":["Development goals"]}]\n```\nHope that helps!';
    expect(parsePolishResponse(raw)).toEqual([{ index: 1, text: ['Development goals'] }]);
  });

  it('accepts a bare string for text', () => {
    expect(parsePolishResponse('[{"index":1,"text":"Heading"}]')).toEqual([
      { index: 1, text: ['Heading'] },
    ]);
  });

  it('returns [] for unusable replies rather than throwing', () => {
    for (const raw of ['', 'I cannot help with that.', '{"index":1}', '[', 'null']) {
      expect(parsePolishResponse(raw)).toEqual([]);
    }
  });

  it('skips malformed entries but keeps the good ones', () => {
    const raw = '[{"index":"x","text":["a"]},{"index":2,"text":[]},{"index":3,"text":["ok"]}]';
    expect(parsePolishResponse(raw)).toEqual([{ index: 3, text: ['ok'] }]);
  });
});

describe('mergePolishedNarrative', () => {
  const narrative = extractNarrative(content);

  it('applies corrections to headings, paragraphs and bullets', () => {
    const merged = mergePolishedNarrative(content, narrative, [
      { index: 1, text: ['Development goals'] },
      { index: 2, text: ['The mentee has performed **well** this quarter.'] },
      { index: 3, text: ['Met **4** times', 'Completed **2** goals'] },
    ]);

    expect(merged.blocks[1]).toMatchObject({ text: 'Development goals' });
    expect(merged.blocks[2]).toMatchObject({
      text: 'The mentee has performed **well** this quarter.',
    });
    expect(merged.blocks[3]).toMatchObject({ items: ['Met **4** times', 'Completed **2** goals'] });
  });

  it('leaves table and KPI blocks byte-identical', () => {
    const merged = mergePolishedNarrative(content, narrative, [
      { index: 0, text: ['Goals set: 400'] },
      { index: 4, text: ['Goal,Status'] },
    ]);
    expect(merged.blocks[0]).toEqual(content.blocks[0]);
    expect(merged.blocks[4]).toEqual(content.blocks[4]);
  });

  it('rejects a bullets block that comes back with a different number of bullets', () => {
    const merged = mergePolishedNarrative(content, narrative, [
      { index: 3, text: ['Met 4 times'] },
    ]);
    expect(merged.blocks[3]).toEqual(content.blocks[3]);
  });

  it('ignores a blank replacement', () => {
    const merged = mergePolishedNarrative(content, narrative, [{ index: 2, text: ['   '] }]);
    expect(merged.blocks[2]).toEqual(content.blocks[2]);
  });

  it('falls back to a bullet original when one of several comes back blank', () => {
    const merged = mergePolishedNarrative(content, narrative, [
      { index: 3, text: ['Met **4** times', '  '] },
    ]);
    expect(merged.blocks[3]).toMatchObject({
      items: ['Met **4** times', 'finished 2 goals'],
    });
  });

  it('cannot add, remove or reorder blocks', () => {
    const merged = mergePolishedNarrative(content, narrative, [
      { index: 99, text: ['A whole new section'] },
    ]);
    expect(merged.blocks).toHaveLength(content.blocks.length);
    expect(merged.blocks.map((b) => b.kind)).toEqual(content.blocks.map((b) => b.kind));
  });

  it('keeps the original when the merged document would break the content contract', () => {
    const tooLong = 'x'.repeat(9000);
    const merged = mergePolishedNarrative(content, narrative, [{ index: 2, text: [tooLong] }]);
    expect(merged).toEqual(content);
  });

  it('is a no-op when the assistant returned nothing', () => {
    expect(mergePolishedNarrative(content, narrative, [])).toEqual(content);
  });
});
