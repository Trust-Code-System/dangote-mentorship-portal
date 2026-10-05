import 'server-only';
import { ForbiddenError, type SessionUser } from '@/lib/auth/rbac';
import { getAssessmentGate } from './data';
import { getGoalSetupGate } from '@/features/goals/onboarding';

// Server-side enforcement of the assessment lock (CLAUDE.md §3: never trust the
// edge or the layout alone). The dashboard layout blocks *navigation* for a
// locked mentee; this guard blocks the *mutations*, so a locked mentee cannot
// keep using the portal by replaying a server action from a stale tab.

export class AssessmentLockedError extends ForbiddenError {
  constructor() {
    super('Your quarterly assessment is overdue. Complete it to continue using the portal.');
    this.name = 'AssessmentLockedError';
  }
}

/**
 * Assert the user is not locked out by an overdue assessment. Call after
 * requireUser()/requireRole() in every participant mutation that a locked
 * mentee must not be able to perform.
 *
 * Deliberately NOT called by the assessment submit itself (that is how the lock
 * is cleared) nor by support/help, so someone who is stuck can still ask.
 */
export async function requirePortalAccess(
  user: SessionUser,
  options: { allowGoalSetup?: boolean } = {},
): Promise<void> {
  // First-goal setup precedes recurring assessments; otherwise each screen can
  // block the action needed to clear the other screen's lock.
  if (options.allowGoalSetup && (await getGoalSetupGate(user)).locked) return;
  const gate = await getAssessmentGate(user);
  if (gate.locked) throw new AssessmentLockedError();
}
