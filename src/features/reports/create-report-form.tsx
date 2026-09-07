'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ReportKind } from '@prisma/client';
import { createReportForm, type CreateReportState } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Build a new report. Deliberately three choices and nothing more: what kind,
// who it is about (mentors only), and how far back to look. Everything else is
// assembled from portal data.
export function CreateReportForm({
  kinds,
  mentees,
}: {
  kinds: ReportKind[];
  mentees: { id: string; name: string }[];
}) {
  const t = useTranslations('reports');
  const tc = useTranslations('common');

  const [kind, setKind] = useState<ReportKind>(kinds[0]!);
  const [menteeId, setMenteeId] = useState<string>(mentees[0]?.id ?? '');
  const [months, setMonths] = useState<string>('3');
  const [state, action, pending] = useActionState<CreateReportState, FormData>(
    createReportForm,
    null,
  );

  // No refresh effect needed: createReport revalidates /reports, so the saved
  // list below re-renders with the new report when the action resolves.
  const needsMentee = kind === ReportKind.MENTOR_PAIR;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">{t('createTitle')}</CardTitle>
        <p className="text-small text-ink-2">{t('createHelp')}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="subjectUserId" value={needsMentee ? menteeId : ''} />
          <input type="hidden" name="periodMonths" value={months === 'all' ? '' : months} />

          <div className="space-y-1.5">
            <Label htmlFor="report-kind">{t('fieldKind')}</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as ReportKind)}>
              <SelectTrigger id="report-kind" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(labelKeyFor(option))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsMentee ? (
            <div className="space-y-1.5">
              <Label htmlFor="report-mentee">{t('fieldMentee')}</Label>
              <Select value={menteeId} onValueChange={setMenteeId}>
                <SelectTrigger id="report-mentee" className="w-56">
                  <SelectValue placeholder={t('noMentees')} />
                </SelectTrigger>
                <SelectContent>
                  {mentees.map((mentee) => (
                    <SelectItem key={mentee.id} value={mentee.id}>
                      {mentee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="report-period">{t('fieldPeriod')}</Label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger id="report-period" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">{t('periodQuarter')}</SelectItem>
                <SelectItem value="6">{t('periodHalfYear')}</SelectItem>
                <SelectItem value="12">{t('periodYear')}</SelectItem>
                <SelectItem value="all">{t('periodToDate')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending || (needsMentee && !menteeId)}>
            {pending ? tc('loading') : t('generate')}
          </Button>

          {state && !state.ok ? (
            <p className="text-small text-risk" role="alert">
              {state.error.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function labelKeyFor(
  kind: ReportKind,
): 'kindMentee' | 'kindMentor' | 'kindProgramme' | 'kindEngagement' {
  switch (kind) {
    case ReportKind.MENTEE_PROGRESS:
      return 'kindMentee';
    case ReportKind.MENTOR_PAIR:
      return 'kindMentor';
    case ReportKind.PROGRAMME:
      return 'kindProgramme';
    case ReportKind.ENGAGEMENT:
      return 'kindEngagement';
  }
}
