import 'server-only';
import { GRAPH_BASE, getGraphToken, readGraphCalendarConfig } from '@/lib/graph/client';
import type { MeetingDraft, MeetingProvider, MeetingProviderResult } from './types';

// Microsoft Outlook calendar provider via Graph (experience-layer.md §1.12). At
// Dangote, "if it isn't in Outlook it doesn't exist" — so a scheduled session is
// pushed to the organizer's calendar with the counterpart as an attendee. Uses
// the shared app-only Graph credentials (Calendars.ReadWrite application
// permission required). Zoom join links remain an M5 concern.
export function createOutlookMeetingProvider(): MeetingProvider {
  const config = readGraphCalendarConfig();

  return {
    id: 'microsoft-graph-calendar',
    enabled: true,

    async createEvent(draft: MeetingDraft): Promise<MeetingProviderResult> {
      const token = await getGraphToken(config);
      const event = {
        transactionId: draft.idempotencyKey,
        subject: draft.title,
        ...(draft.description
          ? { body: { contentType: 'Text', content: draft.description } }
          : {}),
        start: { dateTime: draft.startsAt.toISOString(), timeZone: 'UTC' },
        end: { dateTime: draft.endsAt.toISOString(), timeZone: 'UTC' },
        ...(draft.location ? { location: { displayName: draft.location } } : {}),
        attendees: draft.attendeeEmails.map((address) => ({
          emailAddress: { address },
          type: 'required',
        })),
      };

      const request = () => fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(draft.organizerEmail)}/events`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(15_000),
        },
      );
      let response = await request();
      if (response.status === 429 || response.status === 503) response = await request();
      if (!response.ok) {
        throw new Error(`Graph create event failed: HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        id?: string;
        onlineMeeting?: { joinUrl?: string };
      };
      return { externalId: data.id ?? null, joinUrl: data.onlineMeeting?.joinUrl ?? null };
    },

    async cancelEvent(externalId: string, organizerEmail: string): Promise<void> {
      const token = await getGraphToken(config);
      const response = await fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(organizerEmail)}/events/${encodeURIComponent(externalId)}`,
        { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
      );
      // 404 = already gone; treat as success.
      if (!response.ok && response.status !== 404) {
        throw new Error(`Graph cancel event failed: HTTP ${response.status}`);
      }
    },
  };
}
