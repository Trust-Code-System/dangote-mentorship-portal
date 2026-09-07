import { describe, expect, it } from 'vitest';
import {
  digestLines,
  mergeAssistantDraft,
  parseAssistantDraft,
} from '@/features/newsletters/assistant';
import { emptyNewsletterBody } from '@/features/newsletters/schema';
import type { NewsletterDigest } from '@/features/newsletters/digest';

const digest: NewsletterDigest = {
  cohortName: 'Cohort 2026',
  periodDays: 7,
  goalsApproved: 4,
  goalsSubmitted: 2,
  sessionsLogged: 12,
  meetingsScheduled: 9,
  actionsCompleted: 7,
  actionsOpen: 15,
  activePairs: 11,
  totalPairs: 20,
  upcomingAssessments: [
    { label: 'Month 6 assessment', dueAt: new Date('2026-09-20T00:00:00Z'), submitted: 8, total: 30 },
  ],
  upcomingClinics: [{ title: 'Leading without authority', scheduledAt: new Date('2026-09-18T14:00:00Z') }],
};

describe('digestLines', () => {
  it('states every figure the assistant is allowed to use', () => {
    const lines = digestLines(digest).join('\n');
    expect(lines).toContain('Goals approved in period: 4');
    expect(lines).toContain('Mentoring sessions logged in period: 12');
    expect(lines).toContain('Pairs that logged a session in period: 11 of 20');
    expect(lines).toContain('Month 6 assessment');
    expect(lines).toContain('Leading without authority');
  });

  it('carries no personal data into the prompt', () => {
    // The digest type has no name/email fields at all; assert the rendered
    // prompt lines stay free of an @ address as a regression guard.
    expect(digestLines(digest).join('\n')).not.toMatch(/@/);
  });

  it('handles a clinic with no confirmed date', () => {
    const lines = digestLines({
      ...digest,
      upcomingClinics: [{ title: 'Open session', scheduledAt: null }],
    });
    expect(lines.join('\n')).toContain('date to be confirmed');
  });
});

describe('parseAssistantDraft', () => {
  it('parses subjects and sections', () => {
    const draft = parseAssistantDraft(
      '{"subjectEn":"Week 12","subjectFr":"Semaine 12","sections":[{"kind":"intro","bodyEn":"Hello","bodyFr":"Bonjour"}]}',
    );
    expect(draft?.subjectEn).toBe('Week 12');
    expect(draft?.sections).toEqual([{ kind: 'intro', bodyEn: 'Hello', bodyFr: 'Bonjour' }]);
  });

  it('finds the object inside a fenced block with prose', () => {
    const raw = 'Here is the draft:\n```json\n{"subjectEn":"S","sections":[]}\n```\nEnjoy.';
    expect(parseAssistantDraft(raw)?.subjectEn).toBe('S');
  });

  it('drops sections with an unknown kind', () => {
    const draft = parseAssistantDraft(
      '{"subjectEn":"S","sections":[{"kind":"weather","bodyEn":"x"},{"kind":"numbers","bodyEn":"Goals: 4"}]}',
    );
    expect(draft?.sections.map((s) => s.kind)).toEqual(['numbers']);
  });

  it('returns null for unusable replies', () => {
    for (const raw of ['', 'Sorry, I cannot do that.', '[]', '{"foo":1}']) {
      expect(parseAssistantDraft(raw)).toBeNull();
    }
  });

  it('accepts a reply with only subject lines', () => {
    expect(parseAssistantDraft('{"subjectEn":"Just a subject"}')?.subjectEn).toBe(
      'Just a subject',
    );
  });
});

describe('mergeAssistantDraft', () => {
  it('fills the body of sections the assistant returned', () => {
    const merged = mergeAssistantDraft(emptyNewsletterBody(), {
      subjectEn: 'S',
      subjectFr: 'S',
      sections: [{ kind: 'intro', bodyEn: 'Hello', bodyFr: 'Bonjour' }],
    });
    const intro = merged.sections.find((s) => s.kind === 'intro');
    expect(intro?.bodyEn).toBe('Hello');
    expect(intro?.bodyFr).toBe('Bonjour');
  });

  it('never replaces text the admin already wrote with an empty suggestion', () => {
    const body = emptyNewsletterBody();
    body.sections[0]!.bodyEn = 'Hand-written opening';
    const merged = mergeAssistantDraft(body, {
      subjectEn: '',
      subjectFr: '',
      sections: [{ kind: 'intro', bodyEn: '', bodyFr: 'Ouverture' }],
    });
    expect(merged.sections[0]!.bodyEn).toBe('Hand-written opening');
    expect(merged.sections[0]!.bodyFr).toBe('Ouverture');
  });

  it('keeps the admin headings', () => {
    const body = emptyNewsletterBody();
    body.sections[0]!.headingEn = 'My own heading';
    const merged = mergeAssistantDraft(body, {
      subjectEn: '',
      subjectFr: '',
      sections: [{ kind: 'intro', bodyEn: 'Text', bodyFr: '' }],
    });
    expect(merged.sections[0]!.headingEn).toBe('My own heading');
  });

  it('cannot add, remove or reorder sections', () => {
    const body = emptyNewsletterBody();
    const merged = mergeAssistantDraft(body, {
      subjectEn: '',
      subjectFr: '',
      sections: [
        { kind: 'callToAction', bodyEn: 'Do this', bodyFr: 'Faites ceci' },
        { kind: 'intro', bodyEn: 'Hi', bodyFr: 'Salut' },
      ],
    });
    expect(merged.sections.map((s) => s.kind)).toEqual(body.sections.map((s) => s.kind));
  });

  it('enables a section it actually filled', () => {
    const merged = mergeAssistantDraft(emptyNewsletterBody(), {
      subjectEn: '',
      subjectFr: '',
      sections: [{ kind: 'spotlight', bodyEn: 'A story', bodyFr: '' }],
    });
    expect(merged.sections.find((s) => s.kind === 'spotlight')?.enabled).toBe(true);
  });

  it('leaves an untouched section\'s enabled flag alone', () => {
    const body = emptyNewsletterBody();
    body.sections[1]!.enabled = false;
    const merged = mergeAssistantDraft(body, {
      subjectEn: '',
      subjectFr: '',
      sections: [{ kind: 'intro', bodyEn: 'Hi', bodyFr: '' }],
    });
    expect(merged.sections[1]!.enabled).toBe(false);
  });

  it('is a no-op for an empty draft', () => {
    const body = emptyNewsletterBody();
    expect(mergeAssistantDraft(body, { subjectEn: '', subjectFr: '', sections: [] })).toEqual(
      body,
    );
  });
});
