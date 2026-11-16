import { it, expect } from 'vitest';
import {
  goalSettingDetailsSchema,
  goalSettingReady,
  parseGoalSettingDetails,
} from '@/features/goals/setting-schema';
const complete = {
  menteeName: 'Test Mentee',
  mentorName: 'Test Mentor',
  batch: 'Batch 1',
  department: 'Engineering',
  sessionDate: '2026-11-16',
  support: ['Regular check-ins and accountability'],
  supportOther: '',
  challenges: 'None identified',
  commitment: 'Review actions at each meeting',
  reviewFrequency: 'Monthly',
  nextReviewDate: '2026-12-16',
  accepted: true,
  signedDate: '2026-11-16',
};
it('allows drafts without presenting them as signed or ready for mentor approval', () => {
  expect(parseGoalSettingDetails('broken JSON').accepted).toBe(false);
  expect(goalSettingReady({})).toBe(false);
  expect(goalSettingReady({ ...complete, accepted: false })).toBe(false);
  expect(goalSettingReady(complete)).toBe(true);
});
it('validates follow-up dates and the paper support options', () => {
  expect(
    goalSettingDetailsSchema.safeParse({ ...complete, nextReviewDate: '2026-02-30' }).success,
  ).toBe(false);
  expect(
    goalSettingDetailsSchema.safeParse({ ...complete, support: ['not an option'] }).success,
  ).toBe(false);
  expect(goalSettingReady({ ...complete, support: ['Other'], supportOther: '' })).toBe(false);
});
