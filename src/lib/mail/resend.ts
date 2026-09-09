import 'server-only';
import type { MailTransport, SendEmailInput } from './types';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

type Environment = Readonly<Record<string, string | undefined>>;

export interface ResendMailConfig {
  apiKey: string;
  sender: string;
}

export function isResendMailConfigured(env: Environment = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
}

export function readResendMailConfig(env: Environment = process.env): ResendMailConfig {
  const apiKey = env.RESEND_API_KEY?.trim();
  const sender = env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !sender) {
    throw new Error('Resend mail is selected but RESEND_API_KEY or RESEND_FROM_EMAIL is missing.');
  }
  return { apiKey, sender };
}

export function createResendMailTransport(env: Environment = process.env): MailTransport {
  const config = readResendMailConfig(env);

  return {
    id: 'resend',
    async send(input: SendEmailInput): Promise<void> {
      const response = await fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: config.sender,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Resend mail delivery failed (HTTP ${response.status}).`);
      }
    },
  };
}
