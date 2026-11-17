import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CompetencyType } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CompetencyRow, MentorDetail, MenteeDetail, PairedPerson } from './detail';

// Presentational detail views for a mentor / mentee (full profile + progress).
// Server components — read-only, no client interactivity beyond links.

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// A labelled value; renders an em-dash when empty so the grid stays aligned.
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    // min-w-0 lets the cell shrink in its grid track; break-words wraps long
    // unbroken values (e.g. an email) instead of spilling into the next column.
    <div className="min-w-0 space-y-0.5">
      <dt className="text-micro uppercase text-ink-3">{label}</dt>
      <dd className="whitespace-pre-line break-words text-body text-ink">{empty ? '—' : value}</dd>
    </div>
  );
}

function CompetencyBadges({
  competencies,
  showMenteeFlags,
  generalLabel,
  technicalLabel,
  strengthLabel,
  toStrengthenLabel,
  emptyLabel,
}: {
  competencies: CompetencyRow[];
  showMenteeFlags: boolean;
  generalLabel: string;
  technicalLabel: string;
  strengthLabel: string;
  toStrengthenLabel: string;
  emptyLabel: string;
}) {
  if (competencies.length === 0) return <p className="text-body text-ink-3">{emptyLabel}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {competencies.map((c, i) => {
        const flag = showMenteeFlags
          ? c.isToStrengthen
            ? ` · ${toStrengthenLabel}`
            : c.isStrength
              ? ` · ${strengthLabel}`
              : ''
          : '';
        return (
          <li key={`${c.name}-${i}`}>
            <Badge variant={c.type === CompetencyType.TECHNICAL ? 'info' : 'neutral'}>
              {c.name}
              <span className="opacity-70">
                {' '}
                {c.type === CompetencyType.TECHNICAL ? technicalLabel : generalLabel}
                {flag}
              </span>
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-small text-green hover:text-green-strong hover:underline">
      ← {label}
    </Link>
  );
}

function ProfileHeader({
  name,
  roleLabel,
  subtitle,
  cohortName,
}: {
  name: string;
  roleLabel: string;
  subtitle: string;
  cohortName: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green-soft text-h2 font-semibold text-green-strong">
        {initials(name)}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{name}</h1>
          <Badge variant="default">{roleLabel}</Badge>
        </div>
        <p className="text-body text-ink-2">
          {subtitle} · {cohortName}
        </p>
      </div>
    </div>
  );
}

export async function MentorDetailView({ mentor }: { mentor: MentorDetail }) {
  const [t, p] = await Promise.all([
    getTranslations('profileDetail'),
    getTranslations('people'),
  ]);
  const subtitle = [mentor.jobTitle, mentor.department].filter(Boolean).join(' · ') || p('mentorRole');

  return (
    <section className="space-y-6">
      <BackLink href="/admin/mentors" label={t('backToMentors')} />
      <ProfileHeader name={mentor.fullName} roleLabel={p('mentorRole')} subtitle={subtitle} cohortName={mentor.cohortName} />

      <div className="workspace-section stat-band overflow-hidden">
        <StatTile label={p('training')} value={mentor.trainingStatus} valueClassName="text-h1" tone={mentor.trainingStatus === 'COMPLETED' ? 'ok' : 'default'} />
        <StatTile label={p('matchingCol')} value={mentor.matchingStatus} valueClassName="text-h1" tone={mentor.matchingStatus === 'MATCHED' ? 'ok' : 'default'} />
        <StatTile label={t('mentees')} value={`${mentor.mentees.length} / ${mentor.maxMentees}`} tone="ok" />
        <StatTile label={t('sessionsLogged')} value={mentor.sessionCount} tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('contact')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label={p('email')} value={mentor.email} />
              <Field label={t('phone')} value={mentor.phone} />
              <Field label={t('location')} value={mentor.location} />
              <Field label={p('languageCol')} value={mentor.preferredLanguage} />
              <Field label={t('currentRole')} value={mentor.currentRole} />
              <Field label={p('experience')} value={mentor.yearsExperience != null ? `${mentor.yearsExperience} ${t('years')}` : null} />
              <Field label={t('previousRoles')} value={mentor.previousRoles} />
              <Field label={t('availability')} value={mentor.availability} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('aboutMentor')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <Field label={t('whyMentor')} value={mentor.whyMentor} />
              <Field label={t('whatCanLearn')} value={mentor.whatCanLearn} />
              <Field label={t('personality')} value={mentor.personality} />
              <Field label={t('interests')} value={mentor.interests} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('competencies')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CompetencyBadges
              competencies={mentor.competencies}
              showMenteeFlags={false}
              generalLabel={t('general')}
              technicalLabel={t('technical')}
              strengthLabel={t('strength')}
              toStrengthenLabel={t('toStrengthen')}
              emptyLabel={t('noCompetencies')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('assignedMentees')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PairedList people={mentee_link(mentor.mentees)} emptyLabel={t('noMentees')} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// Helper to map paired people to mentee detail hrefs.
function mentee_link(people: PairedPerson[]) {
  return people.map((m) => ({ name: m.name, href: m.profileId ? `/admin/mentees/${m.profileId}` : null }));
}
function mentor_link(person: PairedPerson | null) {
  if (!person) return null;
  return { name: person.name, href: person.profileId ? `/admin/mentors/${person.profileId}` : null };
}

function PairedList({
  people,
  emptyLabel,
}: {
  people: { name: string | null; href: string | null }[];
  emptyLabel: string;
}) {
  if (people.length === 0) return <p className="text-body text-ink-3">{emptyLabel}</p>;
  return (
    <ul className="space-y-2">
      {people.map((m, i) => (
        <li key={`${m.name}-${i}`}>
          {m.href ? (
            <Link href={m.href} className="text-body text-green hover:text-green-strong hover:underline">
              {m.name ?? '—'}
            </Link>
          ) : (
            <span className="text-body text-ink">{m.name ?? '—'}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export async function MenteeDetailView({ mentee }: { mentee: MenteeDetail }) {
  const [t, p] = await Promise.all([
    getTranslations('profileDetail'),
    getTranslations('people'),
  ]);
  const subtitle = [mentee.jobTitle, mentee.department].filter(Boolean).join(' · ') || p('menteeRole');
  const mentorLink = mentor_link(mentee.mentor);
  const approvedGoals = mentee.goals.filter((g) => g.status === 'APPROVED').length;

  return (
    <section className="space-y-6">
      <BackLink href="/admin/mentees" label={t('backToMentees')} />
      <ProfileHeader name={mentee.fullName} roleLabel={p('menteeRole')} subtitle={subtitle} cohortName={mentee.cohortName} />

      <div className="workspace-section stat-band overflow-hidden">
        <StatTile label={p('training')} value={mentee.trainingStatus} valueClassName="text-h1" tone={mentee.trainingStatus === 'COMPLETED' ? 'ok' : 'default'} />
        <StatTile label={p('matchingCol')} value={mentee.matchingStatus} valueClassName="text-h1" tone={mentee.matchingStatus === 'MATCHED' ? 'ok' : 'default'} />
        <StatTile label={t('goalsApproved')} value={`${approvedGoals} / ${mentee.goals.length}`} tone="ok" />
        <StatTile label={t('sessionsLogged')} value={mentee.sessionCount} tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('contact')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label={p('email')} value={mentee.email} />
              <Field label={t('phone')} value={mentee.phone} />
              <Field label={t('location')} value={mentee.location} />
              <Field label={p('languageCol')} value={mentee.preferredLanguage} />
              <Field label={t('currentGrade')} value={mentee.currentGrade} />
              <Field label={t('previousPositions')} value={mentee.previousPositions} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('aboutMentee')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <Field label={t('careerGoals')} value={mentee.careerGoals} />
              <Field label={t('whyMentee')} value={mentee.whyMentor} />
              <Field label={t('personality')} value={mentee.personality} />
              <Field label={t('interests')} value={mentee.interests} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('competencies')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CompetencyBadges
              competencies={mentee.competencies}
              showMenteeFlags
              generalLabel={t('general')}
              technicalLabel={t('technical')}
              strengthLabel={t('strength')}
              toStrengthenLabel={t('toStrengthen')}
              emptyLabel={t('noCompetencies')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('assignedMentor')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PairedList people={mentorLink ? [mentorLink] : []} emptyLabel={t('noMentor')} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('goals')}</CardTitle>
        </CardHeader>
        <CardContent>
          {mentee.goals.length === 0 ? (
            <p className="text-body text-ink-3">{t('noGoals')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('goalTitle')}</TableHead>
                  <TableHead>{t('competencyCol')}</TableHead>
                  <TableHead>{t('statusCol')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mentee.goals.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.title}</TableCell>
                    <TableCell>{g.competency ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={g.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
