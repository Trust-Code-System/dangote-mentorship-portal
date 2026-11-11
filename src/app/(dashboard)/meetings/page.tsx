import { getTranslations } from 'next-intl/server';
import { RoleName } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
import { getUserMeetings, getSchedulableCounterparts } from '@/features/meetings/data';
import { isUpcoming, needsNoShowCapture } from '@/features/meetings/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScheduleForm } from './schedule-form';
import { MeetingCard } from './meeting-card';

export default async function MeetingsPage() {
  const user = await requireUser();
  const t = await getTranslations('meetings');

  const isMentor = user.roles.includes(RoleName.MENTOR);
  const isMentee = user.roles.includes(RoleName.MENTEE);

  if (!isMentor && !isMentee) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-h1 font-bold text-ink">{t('title')}</h1>
        <p className="text-muted-foreground">{t('noAccess')}</p>
      </div>
    );
  }

  const [meetings, counterparts] = await Promise.all([
    getUserMeetings(user.id),
    getSchedulableCounterparts(user.id, { isMentor, isMentee }),
  ]);

  const needsCapture = meetings.filter((m) => needsNoShowCapture(m));
  const upcoming = meetings.filter((m) => isUpcoming(m));
  const past = meetings.filter((m) => !needsNoShowCapture(m) && !isUpcoming(m));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-h1 font-bold text-ink">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {counterparts.length === 0 ? (
        <p className="text-muted-foreground">{t('notEligible')}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('scheduleTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleForm counterparts={counterparts} />
          </CardContent>
        </Card>
      )}

      {needsCapture.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('needsCapture')}</h2>
          {needsCapture.map((m) => (
            <MeetingCard key={m.id} meeting={m} currentUserId={user.id} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t('upcoming')}</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground">{t('noUpcoming')}</p>
        ) : (
          upcoming.map((m) => <MeetingCard key={m.id} meeting={m} currentUserId={user.id} />)
        )}
      </section>

      {past.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('past')}</h2>
          {past.map((m) => (
            <MeetingCard key={m.id} meeting={m} currentUserId={user.id} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
