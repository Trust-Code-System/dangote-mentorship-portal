'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  saveNotificationPreferencesForm,
  type NotificationActionState,
} from '@/lib/notifications/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Per-user notification preferences (§1.10): email on/off, daily digest on/off,
// and per-type mute toggles. Language always follows the user's locale.
export function PreferencesForm({
  types,
  emailEnabled,
  digestEnabled,
  mutedTypes,
}: {
  types: string[];
  emailEnabled: boolean;
  digestEnabled: boolean;
  mutedTypes: string[];
}) {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const router = useRouter();
  const muted = new Set(mutedTypes);

  const [saved, setSaved] = useState(false);
  const [state, action, pending] = useActionState<NotificationActionState, FormData>(
    saveNotificationPreferencesForm,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSaved(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('prefsTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} onSubmit={() => setSaved(false)} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="emailEnabled" defaultChecked={emailEnabled} className="h-4 w-4" />
            {t('prefEmail')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="digestEnabled" defaultChecked={digestEnabled} className="h-4 w-4" />
            {t('prefDigest')}
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('prefMute')}</legend>
            <p className="text-xs text-muted-foreground">{t('prefMuteHint')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {types.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="muted"
                    value={type}
                    defaultChecked={muted.has(type)}
                    className="h-4 w-4"
                  />
                  {t(`types.${type}.label`)}
                </label>
              ))}
            </div>
          </fieldset>

          {state && !state.ok ? <p className="text-sm text-destructive">{tc('errorBody')}</p> : null}
          {saved ? <p className="text-sm text-green-700">{t('prefsSaved')}</p> : null}

          <Button type="submit" disabled={pending}>
            {pending ? tc('loading') : t('savePrefs')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
