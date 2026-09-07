import { describe, expect, it } from 'vitest';
import {
  emptyNewsletterBody,
  hourIn,
  isDraftDue,
  isoWeekdayIn,
  localDateKey,
  parseNewsletterBody,
  sendableSections,
  weekdayLabel,
} from '@/features/newsletters/schema';

// The schedule decides when a draft appears in the admin's queue. It runs from a
// cron that may fire hourly and may retry, so idempotence and timezone
// correctness are the properties worth pinning down.

describe('isoWeekdayIn', () => {
  it('returns 1 for Monday and 7 for Sunday', () => {
    // 2026-09-07 is a Monday, 2026-09-13 a Sunday.
    expect(isoWeekdayIn(new Date('2026-09-07T12:00:00Z'), 'UTC')).toBe(1);
    expect(isoWeekdayIn(new Date('2026-09-13T12:00:00Z'), 'UTC')).toBe(7);
  });

  it('is evaluated in the given timezone, not the host clock', () => {
    // 23:30 Sunday UTC is already Monday in Tokyo (+09:00).
    const instant = new Date('2026-09-13T23:30:00Z');
    expect(isoWeekdayIn(instant, 'UTC')).toBe(7);
    expect(isoWeekdayIn(instant, 'Asia/Tokyo')).toBe(1);
  });
});

describe('hourIn', () => {
  it('reads the local hour of the target timezone', () => {
    const instant = new Date('2026-09-07T06:30:00Z');
    expect(hourIn(instant, 'UTC')).toBe(6);
    // Africa/Lagos is UTC+1 year-round.
    expect(hourIn(instant, 'Africa/Lagos')).toBe(7);
  });

  it('reports midnight as 0, not 24', () => {
    expect(hourIn(new Date('2026-09-07T23:00:00Z'), 'Africa/Lagos')).toBe(0);
  });
});

describe('localDateKey', () => {
  it('formats as yyyy-mm-dd in the target timezone', () => {
    expect(localDateKey(new Date('2026-09-07T23:30:00Z'), 'Africa/Lagos')).toBe('2026-09-08');
    expect(localDateKey(new Date('2026-09-07T23:30:00Z'), 'UTC')).toBe('2026-09-07');
  });
});

describe('isDraftDue', () => {
  const base = {
    enabled: true,
    // Twice a week: Monday and Thursday.
    sendDays: [1, 4],
    sendHour: 9,
    timezone: 'Africa/Lagos',
    lastDraftedFor: null as Date | null,
  };

  it('is due on a scheduled day once the hour has arrived', () => {
    // 2026-09-07 is a Monday; 09:00 Lagos = 08:00 UTC.
    expect(isDraftDue({ ...base, now: new Date('2026-09-07T08:00:00Z') })).toBe(true);
  });

  it('is not due before the send hour', () => {
    expect(isDraftDue({ ...base, now: new Date('2026-09-07T07:59:00Z') })).toBe(false);
  });

  it('is not due on an unscheduled day', () => {
    // Tuesday.
    expect(isDraftDue({ ...base, now: new Date('2026-09-08T08:00:00Z') })).toBe(false);
  });

  it('is due again on the second scheduled day of the week', () => {
    // Thursday.
    expect(isDraftDue({ ...base, now: new Date('2026-09-10T08:00:00Z') })).toBe(true);
  });

  it('is not due when the schedule is off', () => {
    expect(
      isDraftDue({ ...base, enabled: false, now: new Date('2026-09-07T08:00:00Z') }),
    ).toBe(false);
  });

  it('is not due when no days are selected', () => {
    expect(isDraftDue({ ...base, sendDays: [], now: new Date('2026-09-07T08:00:00Z') })).toBe(
      false,
    );
  });

  it('does not draft twice on the same local day (cron idempotence)', () => {
    const now = new Date('2026-09-07T11:00:00Z');
    expect(
      isDraftDue({ ...base, lastDraftedFor: new Date('2026-09-07T08:05:00Z'), now }),
    ).toBe(false);
  });

  it('drafts again on the next scheduled day after a previous draft', () => {
    expect(
      isDraftDue({
        ...base,
        lastDraftedFor: new Date('2026-09-07T08:05:00Z'),
        now: new Date('2026-09-10T08:00:00Z'),
      }),
    ).toBe(true);
  });

  it('uses the schedule timezone for the same-day check', () => {
    // Drafted 23:30 UTC Sunday = 00:30 Monday in Lagos. A Monday 08:00 UTC run
    // (09:00 Lagos) is the SAME Lagos day, so it must not draft again.
    expect(
      isDraftDue({
        ...base,
        lastDraftedFor: new Date('2026-09-06T23:30:00Z'),
        now: new Date('2026-09-07T08:00:00Z'),
      }),
    ).toBe(false);
  });

  it('treats sendHour 0 as "any time today"', () => {
    expect(
      isDraftDue({ ...base, sendHour: 0, now: new Date('2026-09-07T00:30:00Z') }),
    ).toBe(true);
  });
});

describe('weekdayLabel', () => {
  it('names each ISO weekday', () => {
    expect(weekdayLabel(1, 'en-GB')).toBe('Monday');
    expect(weekdayLabel(7, 'en-GB')).toBe('Sunday');
  });

  it('localizes', () => {
    expect(weekdayLabel(1, 'fr-FR').toLowerCase()).toBe('lundi');
  });
});

describe('emptyNewsletterBody', () => {
  it('starts with the full pre-arranged section order', () => {
    const body = emptyNewsletterBody();
    expect(body.sections.map((s) => s.kind)).toEqual([
      'intro',
      'highlights',
      'numbers',
      'dates',
      'spotlight',
      'callToAction',
    ]);
  });

  it('parses back through the schema', () => {
    expect(parseNewsletterBody(emptyNewsletterBody())).not.toBeNull();
  });

  it('has nothing sendable until text is written', () => {
    expect(sendableSections(emptyNewsletterBody())).toEqual([]);
  });
});

describe('sendableSections', () => {
  it('includes a section with text in either language', () => {
    const body = emptyNewsletterBody();
    body.sections[0]!.bodyFr = 'Bonjour';
    expect(sendableSections(body)).toHaveLength(1);
  });

  it('excludes a disabled section even when it has text', () => {
    const body = emptyNewsletterBody();
    body.sections[0]!.bodyEn = 'Hello';
    body.sections[0]!.enabled = false;
    expect(sendableSections(body)).toEqual([]);
  });

  it('excludes a whitespace-only section', () => {
    const body = emptyNewsletterBody();
    body.sections[0]!.bodyEn = '   \n  ';
    expect(sendableSections(body)).toEqual([]);
  });
});

describe('parseNewsletterBody', () => {
  it('rejects an unknown section kind', () => {
    expect(parseNewsletterBody({ sections: [{ kind: 'video' }] })).toBeNull();
  });

  it('rejects an empty newsletter', () => {
    expect(parseNewsletterBody({ sections: [] })).toBeNull();
  });

  it('fills defaults for omitted optional fields', () => {
    const parsed = parseNewsletterBody({ sections: [{ kind: 'intro' }] });
    expect(parsed?.sections[0]).toEqual({
      kind: 'intro',
      headingEn: '',
      headingFr: '',
      bodyEn: '',
      bodyFr: '',
      enabled: true,
    });
  });
});
