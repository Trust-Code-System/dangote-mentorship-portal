import 'server-only';
import nodemailer from 'nodemailer';
import type { MailTransport, SendEmailInput } from './types';

type Environment = Readonly<Record<string, string | undefined>>;

function readBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    throw new Error(`${name} must be true or false.`);
  }
  return normalized === 'true';
}

export function readSmtpMailConfig(env: Environment = process.env) {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  // Password whitespace can be intentional; never normalize credentials.
  const pass = env.SMTP_PASS;
  const sender = env.SMTP_FROM?.trim();
  if (!host || !user || !pass || !sender) {
    throw new Error('SMTP requires SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.');
  }

  const portText = env.SMTP_PORT?.trim() || '587';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }

  return {
    host,
    port,
    user,
    pass,
    sender,
    secure: readBoolean(env.SMTP_SECURE, port === 465, 'SMTP_SECURE'),
    // Office 365 on port 587 upgrades to TLS via STARTTLS, rather than implicit TLS.
    requireTLS: readBoolean(env.SMTP_REQUIRE_TLS, true, 'SMTP_REQUIRE_TLS'),
  };
}

export function isSmtpMailConfigured(env: Environment = process.env): boolean {
  try {
    readSmtpMailConfig(env);
    return true;
  } catch {
    return false;
  }
}

export function createSmtpMailTransport(env: Environment = process.env): MailTransport {
  const config = readSmtpMailConfig(env);
  const client = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    auth: { user: config.user, pass: config.pass },
    tls: { minVersion: 'TLSv1.2' },
    dnsTimeout: 10_000,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  return {
    id: 'smtp',
    async send(input: SendEmailInput): Promise<void> {
      try {
        const result = await client.sendMail({
          from: config.sender,
          to: { address: input.to, name: '' },
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        });
        if (result.rejected.length > 0 || result.accepted.length === 0) {
          throw new Error('SMTP recipient was rejected.');
        }
      } catch {
        // Provider errors can include addresses or protocol details; keep logs generic.
        throw new Error(
          'SMTP mail delivery failed. Check the mailbox credentials and SMTP AUTH settings.',
        );
      }
    },
  };
}
