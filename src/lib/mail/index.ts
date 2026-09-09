import 'server-only';
import type { MailTransport, SendEmailInput } from './types';
import { createGraphMailTransport, isGraphMailConfigured } from './graph';
import { createResendMailTransport, isResendMailConfigured } from './resend';

export type { MailTransport, SendEmailInput } from './types';

// Default transport: log the email instead of sending it. This keeps auth flows
// (e.g. password reset) fully functional in dev/CI and before a provider is
// configured, without leaking message bodies into structured logs in prod —
// the body is only printed when MAIL_DEBUG is on.
const logTransport: MailTransport = {
  id: 'log',
  async send(input: SendEmailInput): Promise<void> {
    if (process.env.MAIL_DEBUG === 'true') {
      console.info(`[mail:log] to=${input.to} subject="${input.subject}"\n${input.text}`);
    } else {
      console.info(
        `[mail:log] to=${input.to} subject="${input.subject}" (set MAIL_DEBUG=true to print body)`,
      );
    }
  },
};

let cached: MailTransport | null = null;

function unavailableTransport(provider: string): MailTransport {
  return {
    id: `${provider}-misconfigured`,
    async send(): Promise<void> {
      throw new Error(
        `${provider} mail is selected but its required environment variables are incomplete.`,
      );
    },
  };
}

// MAIL_PROVIDER makes the production choice explicit. Without it, Resend wins
// when configured, then Graph, then the development log transport. An explicit
// but incomplete provider fails closed so a newsletter is never marked sent
// when no real delivery was attempted.
export function getMailTransport(): MailTransport {
  if (cached) return cached;

  const selected = process.env.MAIL_PROVIDER?.trim().toLowerCase();
  if (selected === 'resend') {
    cached = isResendMailConfigured()
      ? createResendMailTransport()
      : unavailableTransport('resend');
  } else if (selected === 'microsoft-graph' || selected === 'graph') {
    cached = isGraphMailConfigured()
      ? createGraphMailTransport()
      : unavailableTransport('microsoft-graph');
  } else if (selected === 'log') {
    cached = logTransport;
  } else if (selected) {
    cached = unavailableTransport(selected);
  } else if (isResendMailConfigured()) {
    cached = createResendMailTransport();
  } else {
    cached = isGraphMailConfigured() ? createGraphMailTransport() : logTransport;
  }

  return cached;
}

/** Convenience wrapper used by features that just need to send one email. */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  await getMailTransport().send(input);
}

/** Test-only: reset provider selection after changing environment variables. */
export function resetMailTransportCache(): void {
  cached = null;
}
