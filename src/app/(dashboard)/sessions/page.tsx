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
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-ink-2">{t('subtitle')}</p>
      </div>

      {/* Mentor: log a session + review past logs */}
      {isMentor ? (
        <section className="space-y-4">
          {mentorPairings.length === 0 ? (
            <p className="text-muted-foreground">{t('noPairings')}</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('logSession')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <SessionForm
                    mentees={mentorPairings.map((p) => ({ id: p.menteeId, name: p.menteeName }))}
                  />
                </CardContent>
              </Card>

              {mentorGroups.map((group) => (
                <div key={group.mentee.menteeId} className="space-y-3">
                  <h2 className="font-display text-h2 text-ink">{group.mentee.menteeName}</h2>
                  {group.logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noLogsYet')}</p>
                  ) : (
                    group.logs.map((log) => (
                      <SessionLogCard key={log.id} log={log} viewer="mentor" currentUserId={user.id} />
                    ))
                  )}
                </div>
              ))}
            </>
          )}
        </section>
      ) : null}

      {/* Mentee: view logs + reflect */}
      {isMentee ? (
        <section className="space-y-4">
          <h2 className="font-display text-h2 text-ink">{t('mySessions')}</h2>
          {!menteePairing ? (
            <p className="text-muted-foreground">{t('notEligible')}</p>
          ) : menteeLogs.length === 0 ? (
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
