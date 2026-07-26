// Provider-agnostic meeting/calendar abstraction (CLAUDE.md §2: "abstract behind
// a MeetingProvider interface from the start"). M2 wires the Outlook write-path
// (experience-layer.md §1.12 — push events to participants' calendars via Graph);
// full Zoom join-link provisioning lands in M5 behind this same interface.
export interface MeetingDraft {
  /** Stable application meeting id used as Graph's transactionId for safe retries. */
  idempotencyKey: string;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  /** The scheduling user — the event is created on their calendar. */
  organizerEmail: string;
  attendeeEmails: string[];
  location?: string;
}

export interface MeetingProviderResult {
  /** External calendar event id, when the provider created one. */
  externalId: string | null;
  /** Online-meeting join URL (Zoom/Teams) — null until M5. */
  joinUrl: string | null;
}

export interface MeetingProvider {
  readonly id: string;
  /** False for the no-op default; callers may surface "synced to Outlook" only when true. */
  readonly enabled: boolean;
  createEvent(draft: MeetingDraft): Promise<MeetingProviderResult>;
  cancelEvent(externalId: string, organizerEmail: string): Promise<void>;
}
