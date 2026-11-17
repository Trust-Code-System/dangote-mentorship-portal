'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  SUPPORT_OPTIONS,
  REVIEW_FREQUENCIES,
  parseGoalSettingDetails,
  type GoalSettingDetails,
} from '@/features/goals/setting-schema';

/** The updated paper form's context, alignment, follow-up and mentee acceptance. */
export function GoalSettingFields({
  value,
  onChange,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  prefix: string;
}) {
  const d = parseGoalSettingDetails(value);
  function set<K extends keyof GoalSettingDetails>(key: K, next: GoalSettingDetails[K]) {
    onChange(JSON.stringify({ ...d, [key]: next }));
  }
  const fields: {
    key: 'menteeName' | 'mentorName' | 'batch' | 'department' | 'sessionDate';
    label: string;
    type?: string;
  }[] = [
    { key: 'menteeName', label: 'Mentee name' },
    { key: 'mentorName', label: 'Mentor name' },
    { key: 'batch', label: 'Batch' },
    { key: 'department', label: 'Department / unit' },
    { key: 'sessionDate', label: 'Date of goal-setting session', type: 'date' },
  ];
  return (
    <div className="border-border space-y-6 border-t pt-5">
      <section className="space-y-4">
        <h3 className="font-semibold">Basic information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`${prefix}-${f.key}`}>{f.label}</Label>
              <Input
                id={`${prefix}-${f.key}`}
                type={f.type ?? 'text'}
                value={d[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>
      <fieldset className="space-y-3">
        <legend className="font-semibold">
          How can your mentor support you? Select all that apply.
        </legend>
        {SUPPORT_OPTIONS.map((option) => (
          <label key={option} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0"
              checked={d.support.includes(option)}
              onChange={(e) =>
                set(
                  'support',
                  e.target.checked ? [...d.support, option] : d.support.filter((v) => v !== option),
                )
              }
            />
            {option}
          </label>
        ))}
        {d.support.includes('Other') ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-support-other`}>Other support</Label>
            <Input
              id={`${prefix}-support-other`}
              value={d.supportOther}
              onChange={(e) => set('supportOther', e.target.value)}
            />
          </div>
        ) : null}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-challenges`}>
          What potential challenges might prevent you from reaching this goal?
        </Label>
        <Textarea
          id={`${prefix}-challenges`}
          value={d.challenges}
          onChange={(e) => set('challenges', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-commitment`}>What steps will you take to stay committed?</Label>
        <Textarea
          id={`${prefix}-commitment`}
          value={d.commitment}
          onChange={(e) => set('commitment', e.target.value)}
        />
      </div>
      <fieldset className="space-y-3">
        <legend className="font-semibold">How often will you review progress?</legend>
        {REVIEW_FREQUENCIES.map((option) => (
          <label key={option} className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              name={`${prefix}-review-frequency`}
              className="size-4"
              checked={d.reviewFrequency === option}
              onChange={() => set('reviewFrequency', option)}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-next-review`}>Next review date</Label>
          <Input
            id={`${prefix}-next-review`}
            type="date"
            value={d.nextReviewDate}
            onChange={(e) => set('nextReviewDate', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-signed-date`}>Mentee sign-off date</Label>
          <Input
            id={`${prefix}-signed-date`}
            type="date"
            value={d.signedDate}
            onChange={(e) => set('signedDate', e.target.value)}
          />
        </div>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0"
          checked={d.accepted}
          onChange={(e) => set('accepted', e.target.checked)}
        />
        I confirm these goals and actions as the mentee named above.
      </label>
      <p className="text-muted-foreground text-xs">
        Your mentor signs off through their own account when approving this goal. Save a second goal
        separately if you want to include optional Goal 2.
      </p>
    </div>
  );
}
