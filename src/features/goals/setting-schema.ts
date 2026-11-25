import { z } from 'zod';

export const SUPPORT_OPTIONS = [
  'Regular check-ins and accountability',
  'Sharing resources or tools',
  'Coaching and guidance',
  'Skill-building exercises or challenges',
  'Exposure to new opportunities/networks',
  'Other',
] as const;
export const REVIEW_FREQUENCIES = [
  'Weekly',
  'Biweekly',
  'Monthly',
  'At each mentorship meeting',
] as const;
const text = z.string().trim().max(2000).default('');
const date = z.union([z.literal(''), z.iso.date()]).default('');

export const goalSettingDetailsSchema = z.object({
  menteeName: text,
  mentorName: text,
  batch: text,
  department: text,
  sessionDate: date,
  support: z.array(z.enum(SUPPORT_OPTIONS)).max(SUPPORT_OPTIONS.length).default([]),
  supportOther: text,
  challenges: text,
  commitment: text,
  reviewFrequency: z.union([z.literal(''), z.enum(REVIEW_FREQUENCIES)]).default(''),
  nextReviewDate: date,
  accepted: z.boolean().default(false),
  signedDate: date,
});
export type GoalSettingDetails = z.infer<typeof goalSettingDetailsSchema>;

export function parseGoalSettingDetails(value: unknown): GoalSettingDetails {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  const result = goalSettingDetailsSchema.safeParse(value);
  return result.success ? result.data : goalSettingDetailsSchema.parse({});
}

export function goalSettingReady(value: unknown): boolean {
  const result = goalSettingDetailsSchema.safeParse(value);
  if (!result.success) return false;
  const d = result.data;
  return Boolean(
    d.menteeName &&
    d.mentorName &&
    d.batch &&
    d.department &&
    d.sessionDate &&
    d.support.length &&
    (!d.support.includes('Other') || d.supportOther) &&
    d.commitment &&
    d.reviewFrequency &&
    d.nextReviewDate &&
    d.accepted &&
    d.signedDate,
  );
}
