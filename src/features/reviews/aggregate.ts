import type { FormField } from '@/features/forms/schema';
import type { ReviewAnswers } from './schema';

// ──────────────────────────────────────────────────────────────────────────
// Review roll-up (CLAUDE.md §5 Reviews; §12 executive dashboard). Pure: given a
// form's question set and the submitted answers, produce per-question aggregates
// the reviewer/executive dashboard renders. No I/O, fully unit-tested.
//
// Free-text questions are NOT summarized here — narrative themes (skills,
// common challenges) are the AI Review Assistant's job (§9.4); this module only
// rolls up the quantitative/categorical answers.
// ──────────────────────────────────────────────────────────────────────────

export interface RatingAggregate {
  fieldId: string;
  type: 'rating';
  labelEn: string;
  labelFr: string;
  max: number;
  answered: number;
  average: number | null; // null when nobody answered
  /** distribution[i] = number who chose rating (i+1). */
  distribution: number[];
}

export interface ChoiceCount {
  value: string;
  labelEn: string;
  labelFr: string;
  count: number;
}

export interface SelectAggregate {
  fieldId: string;
  type: 'single_select';
  labelEn: string;
  labelFr: string;
  answered: number;
  counts: ChoiceCount[];
}

export interface BooleanAggregate {
  fieldId: string;
  type: 'boolean';
  labelEn: string;
  labelFr: string;
  answered: number;
  yes: number;
  no: number;
}

export interface TextAggregate {
  fieldId: string;
  type: 'text';
  labelEn: string;
  labelFr: string;
  answered: number;
}

export type FieldAggregate = RatingAggregate | SelectAggregate | BooleanAggregate | TextAggregate;

const DEFAULT_RATING_MAX = 5;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Roll up every question in a form across a set of submitted answers. */
export function aggregateAnswers(
  fields: FormField[],
  responses: ReviewAnswers[],
): FieldAggregate[] {
  return fields
    .filter((field) => !field.confidential && field.reporting !== false)
    .map((field) => aggregateField(field, responses));
}

function aggregateField(field: FormField, responses: ReviewAnswers[]): FieldAggregate {
  const values = responses.map((r) => r[field.id]).filter((v) => v !== undefined && v !== null);

  switch (field.type) {
    case 'rating': {
      const max = field.max ?? DEFAULT_RATING_MAX;
      const distribution = new Array<number>(max).fill(0);
      let sum = 0;
      let answered = 0;
      for (const v of values) {
        const n = typeof v === 'number' ? v : Number(v);
        if (Number.isInteger(n) && n >= 1 && n <= max) {
          distribution[n - 1] = (distribution[n - 1] ?? 0) + 1;
          sum += n;
          answered += 1;
        }
      }
      return {
        fieldId: field.id,
        type: 'rating',
        labelEn: field.labelEn,
        labelFr: field.labelFr,
        max,
        answered,
        average: answered > 0 ? round1(sum / answered) : null,
        distribution,
      };
    }

    case 'single_select': {
      const options = field.options ?? [];
      const tally = new Map<string, number>();
      let answered = 0;
      for (const v of values) {
        const key = String(v);
        if (options.some((o) => o.value === key)) {
          tally.set(key, (tally.get(key) ?? 0) + 1);
          answered += 1;
        }
      }
      return {
        fieldId: field.id,
        type: 'single_select',
        labelEn: field.labelEn,
        labelFr: field.labelFr,
        answered,
        counts: options.map((o) => ({
          value: o.value,
          labelEn: o.labelEn,
          labelFr: o.labelFr,
          count: tally.get(o.value) ?? 0,
        })),
      };
    }

    case 'boolean': {
      let yes = 0;
      let no = 0;
      for (const v of values) {
        if (v === true) yes += 1;
        else if (v === false) no += 1;
      }
      return {
        fieldId: field.id,
        type: 'boolean',
        labelEn: field.labelEn,
        labelFr: field.labelFr,
        answered: yes + no,
        yes,
        no,
      };
    }

    default: {
      // short_text / long_text — count answered only.
      const answered = values.filter((v) => String(v).trim() !== '').length;
      return {
        fieldId: field.id,
        type: 'text',
        labelEn: field.labelEn,
        labelFr: field.labelFr,
        answered,
      };
    }
  }
}

/** Completion rate from a submitted-count and an eligible-count (0–100). */
export function completionPercent(submitted: number, eligible: number): number {
  if (eligible <= 0) return 0;
  return Math.round((submitted / eligible) * 100);
}
