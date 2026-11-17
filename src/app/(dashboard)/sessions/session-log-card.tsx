import { getTranslations } from 'next-intl/server';
import { ActionItemStatus } from '@prisma/client';
import type { SessionLogWithDetail } from '@/features/sessions/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AIContainer } from '@/components/ai-container';
import { ActionItemStatusControl } from './action-item-controls';
import { AddActionItemForm } from './add-action-item-form';
import { ReflectionForm } from './reflection-form';

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

function isOverdue(due: Date | null, status: ActionItemStatus): boolean {
  return due !== null && status !== ActionItemStatus.DONE && due.getTime() < Date.now();
}

export async function SessionLogCard({
  log,
  viewer,
  currentUserId,
}: {
  log: SessionLogWithDetail;
  viewer: 'mentor' | 'mentee';
  currentUserId: string;
}) {
  const t = await getTranslations('sessions');

  return (
    <Card data-session-log-id={log.id}>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {fmtDate(log.date)}
            {log.time ? ` · ${log.time}` : ''}
          </CardTitle>
          <div className="flex flex-wrap gap-1">
            {log.meetingType ? (
              <Badge variant="outline">{t(`type.${log.meetingType}`)}</Badge>
            ) : null}
            {log.competencyDiscussed ? (
              <Badge variant="secondary">{log.competencyDiscussed}</Badge>
            ) : null}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          {viewer === 'mentor' ? log.mentee.name : log.mentor.name}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {log.aiSummary ? (
          <AIContainer title={t('aiSummary')}>
            <p className="whitespace-pre-wrap">{log.aiSummary}</p>
          </AIContainer>
        ) : log.discussionSummary ? (
          <p className="whitespace-pre-wrap">{log.discussionSummary}</p>
        ) : null}

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {log.actionsAgreed ? (
            <Detail label={t('actionsAgreed')} value={log.actionsAgreed} />
          ) : null}
          {log.challenges ? <Detail label={t('challenges')} value={log.challenges} /> : null}
          {log.nextActionPlan ? (
            <Detail label={t('nextActionPlan')} value={log.nextActionPlan} />
          ) : null}
          {log.resourcesNeeded ? (
            <Detail label={t('resourcesNeeded')} value={log.resourcesNeeded} />
          ) : null}
          {log.timeline ? <Detail label={t('timeline')} value={log.timeline} /> : null}
          {log.nextMeetingDate ? (
            <Detail label={t('nextMeetingDate')} value={fmtDate(log.nextMeetingDate)} />
          ) : null}
        </dl>

        {/* Mentor notes are visible to the mentor only. */}
        {viewer === 'mentor' && log.mentorNotes ? (
          <Detail label={t('mentorNotes')} value={log.mentorNotes} />
        ) : null}

        {/* Action items */}
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase">{t('actionItems')}</p>
          {log.actionItems.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('noActionItems')}</p>
          ) : (
            <ul className="space-y-1">
              {log.actionItems.map((item) => {
                const canEdit =
                  item.assigneeId === currentUserId ||
                  (viewer === 'mentee' && log.recordedById === currentUserId);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"
                  >
                    <div className="min-w-0">
                      <p className={isOverdue(item.dueDate, item.status) ? 'text-destructive' : ''}>
                        {item.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {item.assignee?.name ?? t('owner_none')}
                        {item.dueDate ? ` · ${t('due')} ${fmtDate(item.dueDate)}` : ''}
                        {isOverdue(item.dueDate, item.status) ? ` · ${t('overdue')}` : ''}
                      </p>
                    </div>
                    <ActionItemStatusControl
                      itemId={item.id}
                      status={item.status}
                      canEdit={canEdit}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {viewer === 'mentee' && log.recordedById === currentUserId ? (
            <AddActionItemForm sessionLogId={log.id} />
          ) : null}
        </div>

        {/* Reflection */}
        {viewer === 'mentor' ? (
          <ReflectionForm logId={log.id} initial={log.mentorReflection ?? ''} />
        ) : log.mentorReflection ? (
          <div className="border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t('mentorReflection')}
            </p>
            <p className="whitespace-pre-wrap">{log.mentorReflection}</p>
          </div>
        ) : null}
        {log.menteeReflection ? (
          <div className="border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t('menteeReflection')}
            </p>
            <p className="whitespace-pre-wrap">{log.menteeReflection}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium uppercase">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
