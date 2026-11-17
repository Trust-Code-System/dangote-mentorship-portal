import { requireRole } from '@/lib/auth/rbac';
import { RoleName } from '@/lib/auth/roles';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { MentorSummary } from '@/components/dashboard/mentor-summary';
import { JourneyRail } from '@/components/journey-rail';
import { NextActionButton } from '@/components/next-action-button';
import { MatchPanel } from '@/features/matching/match-panel';
import { getJourney } from '@/features/journey/data';
import { getMentorDashboard } from '@/features/dashboard/data';

export default async function MentorDashboardPage() {
  const user = await requireRole(RoleName.MENTOR);
  const [journey, dashboard] = await Promise.all([
    getJourney(user.id, 'mentor'),
    getMentorDashboard(user.id),
  ]);
  return (
    <div className="space-y-7">
      <DashboardHeader titleKey="mentor" userName={user.name} roles={user.roles} />
      {/* Pending/accepted pairings with accept/reject (CLAUDE.md §4: mentors
          accept/reject their own). */}
      <MentorSummary data={dashboard} />
      <MatchPanel userId={user.id} role="mentor" hideAccepted />
      <NextActionButton />
      <JourneyRail result={journey} />
    </div>
  );
}
