import { getTranslations } from 'next-intl/server';
import { InviteStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser, hasAnyRole } from '@/lib/auth/rbac';
import { RoleName, ALL_ROLES, ADMIN_ROLES } from '@/lib/auth/roles';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InviteCreateForm } from './invite-create-form';
import { InviteRevokeButton } from './invite-revoke-button';

export default async function InvitesPage() {
  const t = await getTranslations('invites');
  const tc = await getTranslations('common');
  const user = await requireUser();
  // Programme Admins may invite participants; only Super Admins may invite
  // other admins (enforced again server-side in createInvite).
  const isSuperAdmin = hasAnyRole(user, RoleName.SUPER_ADMIN);
  const invitableRoles = isSuperAdmin
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => !ADMIN_ROLES.includes(r));

  const [invites, cohorts] = await Promise.all([
    prisma.invite.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { cohort: { select: { name: true } } },
      take: 100,
    }),
    prisma.cohort.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <InviteCreateForm roles={invitableRoles} cohorts={cohorts} />

      {invites.length === 0 ? (
        <p className="text-muted-foreground">{t('noInvites')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('cohort')}</TableHead>
              <TableHead>{tc('status')}</TableHead>
              <TableHead>{t('expires')}</TableHead>
              <TableHead>{tc('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>{invite.roleName}</TableCell>
                <TableCell>{invite.cohort?.name ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={invite.status} />
                </TableCell>
                <TableCell>{invite.expiresAt.toISOString().slice(0, 10)}</TableCell>
                <TableCell>
                  {invite.status === InviteStatus.PENDING ? (
                    <InviteRevokeButton inviteId={invite.id} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
