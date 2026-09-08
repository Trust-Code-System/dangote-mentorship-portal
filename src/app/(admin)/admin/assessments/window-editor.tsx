'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  setAssessmentWindowActiveForm,
  updateAssessmentWindowForm,
  type WindowFormState,
} from '@/features/assessments/form-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// One editable row of the assessment schedule. Moving a due date or turning a
// window off is the admin's escape hatch for a mentee who is locked out for a
// good reason, so it lives right next to the completion numbers.
export function WindowEditor({
  window,
  meta,
  isFocused,
  formType,
}: {
  window: {
    id: string;
    label: string;
    opensAt: string;
    dueAt: string;
    graceDays: number;
    isActive: boolean;
  };
  meta: string;
  isFocused: boolean;
  /** Kept on the "view completion" link so switching window doesn't switch tab. */
  formType: string;
}) {
  const t = useTranslations('assessments');
  const tc = useTranslations('common');
  const [saveState, saveAction, savePending] = useActionState<WindowFormState, FormData>(
    updateAssessmentWindowForm,
    null,
  );
  const [, toggleAction, togglePending] = useActionState<WindowFormState, FormData>(
    setAssessmentWindowActiveForm,
    null,
  );

  return (
    <div
      className={`rounded-md border p-4 ${isFocused ? 'border-green bg-green-soft/30' : 'border-border'}`}
    >
      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="windowId" value={window.id} />
        <input type="hidden" name="isActive" value={String(window.isActive)} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={window.isActive ? 'ok' : 'neutral'}>
              {window.isActive ? t('windowActive') : t('windowInactive')}
            </Badge>
            <p className="text-small text-ink-2">{meta}</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/assessments?type=${formType}&window=${window.id}`}>
              {t('viewCompletion')}
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor={`label-${window.id}`}>{t('windowLabel')}</Label>
            <Input
              id={`label-${window.id}`}
              name="label"
              defaultValue={window.label}
              maxLength={160}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`opensAt-${window.id}`}>{t('opensAt')}</Label>
            <Input
              id={`opensAt-${window.id}`}
              name="opensAt"
              type="date"
              defaultValue={toDateInput(window.opensAt)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`dueAt-${window.id}`}>{t('dueAt')}</Label>
            <Input
              id={`dueAt-${window.id}`}
              name="dueAt"
              type="date"
              defaultValue={toDateInput(window.dueAt)}
              required
            />
          </div>
          {/* Grace only means something when access is being withheld; the
              monthly form withholds nothing, so the field is hidden (and the
              value posted unchanged) rather than shown as a no-op. */}
          {formType === 'MONTHLY' ? (
            <input type="hidden" name="graceDays" value={window.graceDays} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`grace-${window.id}`}>{t('graceDays')}</Label>
              <Input
                id={`grace-${window.id}`}
                name="graceDays"
                type="number"
                min={0}
                max={90}
                defaultValue={window.graceDays}
                required
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={savePending}>
            {savePending ? tc('loading') : tc('save')}
          </Button>
          {saveState?.ok ? (
            <span className="text-small text-green-strong" role="status">
              {t('saved')}
            </span>
          ) : null}
          {saveState && !saveState.ok ? (
            <span className="text-small text-risk" role="alert">
              {saveState.error.message}
            </span>
          ) : null}
        </div>
      </form>

      <form action={toggleAction} className="mt-2">
        <input type="hidden" name="windowId" value={window.id} />
        <input type="hidden" name="isActive" value={window.isActive ? 'false' : 'true'} />
        <Button type="submit" variant="outline" size="sm" disabled={togglePending}>
          {window.isActive ? t('deactivateWindow') : t('activateWindow')}
        </Button>
      </form>
    </div>
  );
}

/** ISO timestamp → the yyyy-mm-dd a date input expects. */
function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}
