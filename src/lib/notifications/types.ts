// Notification taxonomy + pure channel rules (experience-layer.md §1.10). Kept
// free of `server-only`/Prisma so the routing logic is unit-testable. The string
// values double as the i18n key under the `notifications.types` namespace and as
// the `Notification.type` column value.

export const NOTIFICATION_TYPES = [
  'profile_incomplete',
  'match_ready',
  'match_accepted',
  'goal_commented',
  'goal_submitted',
  'meeting_scheduled',
  'meeting_cancelled',
  'meeting_reminder',
  'session_log_due',
  'session_logged',
  'agreement_signed',
  'message_received',
  'review_due',
  'clinic_tomorrow',
  'support_received',
  'support_responded',
  // Quarterly assessment gate (features/assessments): a reminder while the
  // window is open, and an escalation once it is overdue and access is at risk.
  'assessment_due',
  'assessment_overdue',
  // The monthly meeting form. Same shape, but it never gates access, so the
  // copy asks rather than warns.
  'monthly_form_due',
  'monthly_form_overdue',
  // A scheduled newsletter draft is waiting for an admin to review and approve.
  'newsletter_draft_ready',
  // The weekly engagement report has been generated for admins to read.
  'engagement_report_ready',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Time-critical types carry a deadline/time element, so their email is sent
// immediately rather than waiting for the daily digest (§1.10 batching rule).
const TIME_CRITICAL: ReadonlySet<NotificationType> = new Set([
  'meeting_reminder',
  'meeting_cancelled',
  'session_log_due',
  'review_due',
  'clinic_tomorrow',
  // Losing portal access is a deadline; it does not wait for tomorrow's digest.
  'assessment_overdue',
]);

export function isTimeCritical(type: NotificationType): boolean {
  return TIME_CRITICAL.has(type);
}

export interface ChannelPrefs {
  emailEnabled: boolean;
  digestEnabled: boolean;
}

export type EmailChannel = 'immediate' | 'digest' | 'none';

/**
 * Decide how (if at all) a notification should reach email. In-app delivery is
 * always immediate and decided separately — this governs the email channel only.
 * Time-critical → immediate; otherwise the daily digest (when enabled).
 */
export function selectEmailChannel(type: NotificationType, prefs: ChannelPrefs): EmailChannel {
  if (!prefs.emailEnabled) return 'none';
  if (isTimeCritical(type)) return 'immediate';
  return prefs.digestEnabled ? 'digest' : 'none';
}

/** A muted type produces no notification at all (no in-app row, no email). */
export function isMuted(type: NotificationType, mutedTypes: readonly string[]): boolean {
  return mutedTypes.includes(type);
}

export const DEFAULT_PREFS = {
  emailEnabled: true,
  digestEnabled: true,
  mutedTypes: [] as string[],
};
