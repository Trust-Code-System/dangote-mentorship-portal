import { getTranslations } from 'next-intl/server';
import { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import {
  updateOwnAccountForm,
  updateOwnMenteeProfileForm,
  updateOwnMentorProfileForm,
} from '@/features/profiles/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AvatarUploader } from './avatar-uploader';

function initialsOf(name: string | null, email: string): string {
  const source = (name?.trim() || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const [a, b] = parts;
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function Field({
  id,
  label,
  name,
  defaultValue,
  type = 'text',
}: {
  id: string;
  label: string;
  name: string;
  defaultValue: string | number | null;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} defaultValue={defaultValue ?? ''} />
    </div>
  );
}

const ROLE_LABEL_KEY: Record<RoleName, string> = {
  [RoleName.SUPER_ADMIN]: 'roleSuperAdmin',
  [RoleName.MENTOR]: 'roleMentor',
  [RoleName.MENTEE]: 'roleMentee',
};

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const t = await getTranslations('profile');

  const [account, mentorProfile, menteeProfile] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, timezone: true, locale: true, image: true },
    }),
    prisma.mentorProfile.findUnique({
      where: { userId: sessionUser.id },
      include: { competencies: { include: { competency: true } } },
    }),
    prisma.menteeProfile.findUnique({
      where: { userId: sessionUser.id },
      include: { competencies: { include: { competency: true } } },
    }),
  ]);

  const tc = await getTranslations('common');
  const languageLabel = account.locale === 'FR' ? tc('french') : tc('english');

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Account — shown to every user, regardless of mentorship role. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('accountTitle')}</CardTitle>
          <CardDescription>{t('accountDescription')}</CardDescription>
          {/* Layout container must be a <div>, not <p>: Badge renders a <div>,
              and a <div> inside <p> is invalid HTML → hydration mismatch (#418). */}
          <div className="flex flex-wrap gap-1 pt-1">
            {sessionUser.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {t(ROLE_LABEL_KEY[role])}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUploader
            imageUrl={account.image ? `/api/avatar/${account.id}` : null}
            initials={initialsOf(account.name, account.email)}
          />
          <form action={updateOwnAccountForm} className="grid gap-4 sm:grid-cols-2">
            <Field id="acct-name" label={t('name')} name="name" defaultValue={account.name} />
            <div className="space-y-1">
              <Label htmlFor="acct-email">{t('email')}</Label>
              <Input id="acct-email" type="email" defaultValue={account.email} disabled readOnly />
              <p className="text-xs text-muted-foreground">{t('emailHint')}</p>
            </div>
            <div className="space-y-1">
              <Field
                id="acct-timezone"
                label={t('timezone')}
                name="timezone"
                defaultValue={account.timezone}
              />
              <p className="text-xs text-muted-foreground">{t('timezoneHint')}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="acct-language">{t('preferredLanguage')}</Label>
              <Input id="acct-language" defaultValue={languageLabel} disabled readOnly />
              <p className="text-xs text-muted-foreground">{t('uiLanguageHint')}</p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">{t('saveAccount')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!mentorProfile && !menteeProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('mentorshipProfileTitle')}</CardTitle>
            <CardDescription>{t('noProfile')}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {mentorProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {mentorProfile.fullName}{' '}
              <Badge variant="secondary">{mentorProfile.preferredLanguage}</Badge>
            </CardTitle>
            {mentorProfile.competencies.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {mentorProfile.competencies.map((c) => (
                  <Badge key={c.id} variant="outline">
                    {c.competency.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <form action={updateOwnMentorProfileForm} className="grid gap-4 sm:grid-cols-2">
              <Field id="phone" label={t('phone')} name="phone" defaultValue={mentorProfile.phone} />
              <Field id="department" label={t('department')} name="department" defaultValue={mentorProfile.department} />
              <Field id="jobTitle" label={t('jobTitle')} name="jobTitle" defaultValue={mentorProfile.jobTitle} />
              <Field id="location" label={t('location')} name="location" defaultValue={mentorProfile.location} />
              <Field id="yearsExperience" label={t('yearsExperience')} name="yearsExperience" type="number" defaultValue={mentorProfile.yearsExperience} />
              <Field id="personality" label={t('personality')} name="personality" defaultValue={mentorProfile.personality} />
              <Field id="availability" label={t('availability')} name="availability" defaultValue={mentorProfile.availability} />
              <Field id="interests" label={t('interests')} name="interests" defaultValue={mentorProfile.interests} />
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="whyMentor">{t('whyMentor')}</Label>
                <Input id="whyMentor" name="whyMentor" defaultValue={mentorProfile.whyMentor ?? ''} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="whatCanLearn">{t('whatCanLearn')}</Label>
                <Input id="whatCanLearn" name="whatCanLearn" defaultValue={mentorProfile.whatCanLearn ?? ''} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">{t('save')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {menteeProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {menteeProfile.fullName}{' '}
              <Badge variant="secondary">{menteeProfile.preferredLanguage}</Badge>
            </CardTitle>
            {menteeProfile.competencies.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {menteeProfile.competencies.map((c) => (
                  <Badge key={c.id} variant={c.isToStrengthen ? 'outline' : 'secondary'}>
                    {c.competency.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <form action={updateOwnMenteeProfileForm} className="grid gap-4 sm:grid-cols-2">
              <Field id="m-phone" label={t('phone')} name="phone" defaultValue={menteeProfile.phone} />
              <Field id="m-department" label={t('department')} name="department" defaultValue={menteeProfile.department} />
              <Field id="m-jobTitle" label={t('jobTitle')} name="jobTitle" defaultValue={menteeProfile.jobTitle} />
              <Field id="m-location" label={t('location')} name="location" defaultValue={menteeProfile.location} />
              <Field id="m-currentGrade" label={t('currentGrade')} name="currentGrade" defaultValue={menteeProfile.currentGrade} />
              <Field id="m-personality" label={t('personality')} name="personality" defaultValue={menteeProfile.personality} />
              <Field id="m-interests" label={t('interests')} name="interests" defaultValue={menteeProfile.interests} />
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="m-whyMentor">{t('whyMentee')}</Label>
                <Input id="m-whyMentor" name="whyMentor" defaultValue={menteeProfile.whyMentor ?? ''} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="m-careerGoals">{t('careerGoals')}</Label>
                <Input id="m-careerGoals" name="careerGoals" defaultValue={menteeProfile.careerGoals ?? ''} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">{t('save')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
