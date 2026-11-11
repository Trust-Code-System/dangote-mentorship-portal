import { getTranslations } from 'next-intl/server';
import { RoleName } from '@prisma/client';
import { requireUser } from '@/lib/auth/rbac';
import {
  getMyReflections,
  getMenteeLogOptions,
  getMenteeCohortId,
  getSharedReflections,
  getMentorNoteGroups,
} from '@/features/reflections/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReflectionForm } from './reflection-form';
import { ReflectionEntry } from './reflection-entry';
import { MentorNoteForm } from './mentor-note-form';
import { MentorNoteCard } from './mentor-note-card';

// Reflection journal (mentee) + private notes (mentor) — experience-layer.md
// §1.16. Both are private by default; only a reflection the mentee explicitly
// shares is visible to their mentor. Admins never see content here.
export default async function JournalPage() {
  const user = await requireUser();
  const t = await getTranslations('journal');

  const isMentee = user.roles.includes(RoleName.MENTEE);
  const isMentor = user.roles.includes(RoleName.MENTOR);

  const [myEntries, logOptions, menteeCohortId, sharedEntries, noteGroups] = await Promise.all([
    isMentee ? getMyReflections(user.id) : Promise.resolve([]),
    isMentee ? getMenteeLogOptions(user.id) : Promise.resolve([]),
    isMentee ? getMenteeCohortId(user.id) : Promise.resolve(null),
    isMentor ? getSharedReflections(user.id) : Promise.resolve([]),
    isMentor ? getMentorNoteGroups(user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-h1 font-bold text-ink">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Mentee: private reflection journal */}
      {isMentee ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t('myJournal')}</h2>
          {!menteeCohortId ? (
            <p className="text-muted-foreground">{t('noCohort')}</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('newEntry')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ReflectionForm
                  cohortId={menteeCohortId}
                  defaultLang={user.locale === 'FR' ? 'FR' : 'EN'}
                  logOptions={logOptions.map((l) => ({
                    id: l.id,
                    label: l.date
                      ? `${l.date.toISOString().slice(0, 10)}${
                          l.competencyDiscussed ? ` · ${l.competencyDiscussed}` : ''
                        }`
                      : (l.competencyDiscussed ?? l.id.slice(0, 6)),
                  }))}
                />
              </CardContent>
            </Card>
          )}

          <p className="text-sm font-medium text-muted-foreground">{t('privateNotice')}</p>
          {myEntries.length === 0 ? (
            <p className="text-muted-foreground">{t('noEntries')}</p>
          ) : (
            <div className="space-y-3">
              {myEntries.map((entry) => (
                <ReflectionEntry key={entry.id} entry={serialize(entry)} viewer="owner" />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Mentor: shared reflections + private notes per mentee */}
      {isMentor ? (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('sharedWithMe')}</h2>
            {sharedEntries.length === 0 ? (
              <p className="text-muted-foreground">{t('noShared')}</p>
            ) : (
              <div className="space-y-3">
                {sharedEntries.map((entry) => (
                  <ReflectionEntry key={entry.id} entry={serialize(entry)} viewer="mentor" />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('myNotes')}</h2>
            <p className="text-sm text-muted-foreground">{t('notesPrivateNotice')}</p>
            {noteGroups.length === 0 ? (
              <p className="text-muted-foreground">{t('noMentees')}</p>
            ) : (
              noteGroups.map((group) => (
                <Card key={group.mentee.menteeId}>
                  <CardHeader>
                    <CardTitle className="text-base">{group.mentee.menteeName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <MentorNoteForm
                      menteeId={group.mentee.menteeId}
                      defaultLang={user.locale === 'FR' ? 'FR' : 'EN'}
                    />
                    {group.notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('noNotesYet')}</p>
                    ) : (
                      group.notes.map((note) => (
                        <MentorNoteCard
                          key={note.id}
                          note={{
                            id: note.id,
                            kind: note.kind,
                            body: note.body,
                            bodyLang: note.bodyLang,
                            createdAt: note.createdAt.toISOString(),
                          }}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </>
      ) : null}

      {!isMentee && !isMentor ? <p className="text-muted-foreground">{t('noAccess')}</p> : null}
    </div>
  );
}

function serialize(entry: {
  id: string;
  title: string | null;
  body: string;
  bodyLang: 'EN' | 'FR';
  isSharedWithMentor: boolean;
  sessionDate: Date | null;
  authorName: string | null;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    bodyLang: entry.bodyLang,
    isSharedWithMentor: entry.isSharedWithMentor,
    sessionDate: entry.sessionDate ? entry.sessionDate.toISOString().slice(0, 10) : null,
    authorName: entry.authorName,
    createdAt: entry.createdAt.toISOString(),
  };
}
