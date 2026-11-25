import { getTranslations } from 'next-intl/server';
import { RoleName } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
import {
  getMentorPairings,
  getMentorSessionGroups,
  getMenteeSessionLogs,
  getMenteePairing,
} from '@/features/sessions/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionForm } from './session-form';
import { SessionLogCard } from './session-log-card';

export default async function SessionsPage() {
  const user = await requireUser();
  const t = await getTranslations('sessions');

  const isMentor = user.roles.includes(RoleName.MENTOR);
  const isMentee = user.roles.includes(RoleName.MENTEE);

  const [mentorPairings, mentorGroups, menteePairing, menteeLogs] = await Promise.all([
    isMentor ? getMentorPairings(user.id) : Promise.resolve([]),
    isMentor ? getMentorSessionGroups(user.id) : Promise.resolve([]),
    isMentee ? getMenteePairing(user.id) : Promise.resolve(null),
    isMentee ? getMenteeSessionLogs(user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-h1 text-ink font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-ink-2">{t('subtitle')}</p>
      </div>

      {/* Mentor: read the mentee's shared record and add a reflection. */}
      {isMentor ? (
        <section className="space-y-4">
          {mentorPairings.length === 0 ? (
            <p className="text-muted-foreground">{t('noPairings')}</p>
          ) : (
            <>
              <p className="text-ink-2">{t('mentorWorkflow')}</p>

              {mentorGroups.map((group) => (
                <div key={group.mentee.menteeId} className="space-y-3">
                  <h2 className="font-display text-h2 text-ink">{group.mentee.menteeName}</h2>
                  {group.logs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('noLogsYet')}</p>
                  ) : (
                    group.logs.map((log) => (
                      <SessionLogCard
                        key={log.id}
                        log={log}
                        viewer="mentor"
                        currentUserId={user.id}
                      />
                    ))
                  )}
                </div>
              ))}
            </>
          )}
        </section>
      ) : null}

      {/* Mentee: record the session, then read the mentor's reflection. */}
      {isMentee ? (
        <section className="space-y-4">
          {!menteePairing ? (
            <p className="text-muted-foreground">{t('notEligible')}</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('logSession')}</CardTitle>
              </CardHeader>
              <CardContent>
                <SessionForm
                  menteeId={user.id}
                  cohortId={menteePairing.cohortId}
                  mentorName={menteePairing.mentorName}
                />
              </CardContent>
            </Card>
          )}
          <h2 className="font-display text-h2 text-ink">{t('mySessions')}</h2>
          {menteeLogs.length === 0 ? (
            <p className="text-muted-foreground">{t('noLogsMentee')}</p>
          ) : (
            menteeLogs.map((log) => (
              <SessionLogCard key={log.id} log={log} viewer="mentee" currentUserId={user.id} />
            ))
          )}
        </section>
      ) : null}

      {!isMentor && !isMentee ? <p className="text-muted-foreground">{t('noAccess')}</p> : null}
    </div>
  );
}
