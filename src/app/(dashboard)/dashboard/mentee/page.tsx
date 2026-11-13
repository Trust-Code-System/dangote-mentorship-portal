import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { requireRole } from '@/lib/auth/rbac';
import { RoleName } from '@/lib/auth/roles';
import { MenteeSummary } from '@/components/dashboard/mentee-summary';
import { JourneyRail } from '@/components/journey-rail';
import { NextActionButton } from '@/components/next-action-button';
import { MatchPanel } from '@/features/matching/match-panel';
import { getJourney } from '@/features/journey/data';
import { getMenteeDashboard } from '@/features/dashboard/data';

export default async function MenteeDashboardPage() {
  const user = await requireRole(RoleName.MENTEE);
  const [journey, dashboard] = await Promise.all([
    getJourney(user.id, 'mentee'),
    getMenteeDashboard(user.id),
  ]);
  return (
    <div className="space-y-7">
      <DashboardHeader titleKey="mentee" userName={user.name} roles={user.roles} />
      {/* Pending/accepted pairings with accept/confirm (CLAUDE.md §4: mentees
          accept/confirm their own). */}
      <MatchPanel userId={user.id} role="mentee" hideAccepted />
      <MenteeSummary data={dashboard} />
      <JourneyRail result={journey} />
      <NextActionButton />
    </div>
  );
}
