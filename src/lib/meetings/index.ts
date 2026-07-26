import 'server-only';
import { getIntegrationHealth } from '@/lib/integrations/health';
import { createNoopMeetingProvider } from './noop';
import { createOutlookMeetingProvider } from './outlook';
import type { MeetingProvider } from './types';

export type { MeetingProvider, MeetingDraft, MeetingProviderResult } from './types';

let cached: MeetingProvider | null = null;

// Selects the active meeting provider behind an env check — like getMailTransport()
// / getStorageProvider() / getAiAdapter(). Outlook (Graph) when its credentials
// exist (CLAUDE.md §2, experience-layer.md §1.12), else a no-op so scheduling
// works dark. Zoom slots in here in M5 behind the same interface.
export function getMeetingProvider(): MeetingProvider {
  if (cached) return cached;
  cached = getIntegrationHealth().graphCalendar.configured
    ? createOutlookMeetingProvider()
    : createNoopMeetingProvider();
  return cached;
}
