'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  saveNewsletterScheduleForm,
  type ScheduleState,
} from '@/features/newsletters/actions';
import { ISO_WEEKDAYS, weekdayLabel } from '@/features/newsletters/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The recurring cadence — the admin sends twice a week, so the days are
// checkboxes rather than a cron expression. The schedule prepares a draft and
// notifies; it never sends on its own, and the copy says so plainly.
export function ScheduleForm({
  cohortId,
  enabled,
  sendDays,
  sendHour,
  timezone,
  autoDraft,
}: {
  cohortId: string;
  enabled: boolean;
  sendDays: number[];
  sendHour: number;
  timezone: string;
  autoDraft: boolean;
}) {
  const t = useTranslations('newsletters');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [state, action, pending] = useActionState<ScheduleState, FormData>(
    saveNewsletterScheduleForm,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">{t('scheduleTitle')}</CardTitle>
        <p className="text-small text-ink-2">{t('scheduleHelp')}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="cohortId" value={cohortId} />

          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={enabled}
              className="size-4 rounded border-border text-green focus:ring-green/30"
            />
            {t('scheduleEnabled')}
          </label>

          <fieldset className="space-y-2">
            <legend className="text-h3 text-ink">{t('scheduleDays')}</legend>
            <div className="flex flex-wrap gap-3">
              {ISO_WEEKDAYS.map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-small text-ink"
                >
                  <input
                    type="checkbox"
                    name="sendDays"
                    value={day}
                    defaultChecked={sendDays.includes(day)}
                    className="size-4 rounded border-border text-green focus:ring-green/30"
                  />
                  {weekdayLabel(day, locale)}
                </label>
              ))}
            </div>
            {state && !state.ok && state.error.fieldErrors?.sendDays ? (
              <p className="text-small text-risk" role="alert">
                {state.error.fieldErrors.sendDays[0]}
              </p>
            ) : null}
          </fieldset>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sendHour">{t('scheduleHour')}</Label>
              <Input
                id="sendHour"
                name="sendHour"
                type="number"
                min={0}
                max={23}
                defaultValue={sendHour}
                className="w-24"
                aria-describedby="sendHour-hint"
                required
              />
              <p id="sendHour-hint" className="max-w-md text-small text-ink-3">
                {t('scheduleHourHint')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">{t('scheduleTimezone')}</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={timezone}
                maxLength={64}
                className="w-56"
                required
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-body text-ink">
            <input
              type="checkbox"
              name="autoDraft"
              defaultChecked={autoDraft}
              className="mt-1 size-4 rounded border-border text-green focus:ring-green/30"
            />
            <span>
              {t('scheduleAutoDraft')}
              <span className="block text-small text-ink-2">{t('scheduleAutoDraftHint')}</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? tc('loading') : tc('save')}
            </Button>
            {state?.ok ? (
              <span className="text-small text-green-strong" role="status">
                {t('saved')}
              </span>
            ) : null}
            {state && !state.ok && !state.error.fieldErrors ? (
              <span className="text-small text-risk" role="alert">
                {state.error.message}
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
