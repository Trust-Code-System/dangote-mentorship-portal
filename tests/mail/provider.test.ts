import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMailTransport, resetMailTransportCache } from '@/lib/mail';

vi.mock('server-only', () => ({}));

afterEach(() => {
  resetMailTransportCache();
  vi.unstubAllEnvs();
});

describe('mail provider selection', () => {
  it('selects SMTP explicitly even when Resend is also configured', () => {
    vi.stubEnv('MAIL_PROVIDER', ' smtp\r\n ');
    vi.stubEnv('SMTP_HOST', 'smtp.office365.com');
    vi.stubEnv('SMTP_USER', 'sender@example.com');
    vi.stubEnv('SMTP_PASS', 'test-password');
    vi.stubEnv('SMTP_FROM', 'sender@example.com');
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('RESEND_FROM_EMAIL', 'notifications@mail.example.com');
    expect(getMailTransport().id).toBe('smtp');
  });

  it('fails closed when SMTP is explicitly selected but incomplete', async () => {
    vi.stubEnv('MAIL_PROVIDER', 'smtp');
    vi.stubEnv('SMTP_PASS', '');
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('RESEND_FROM_EMAIL', 'notifications@mail.example.com');
    const transport = getMailTransport();
    expect(transport.id).toBe('smtp-misconfigured');
    await expect(
      transport.send({
        to: 'participant@example.com',
        subject: 'Update',
        text: 'Body',
      }),
    ).rejects.toThrow('smtp mail is selected');
  });

  it('selects configured SMTP before the log fallback', () => {
    vi.stubEnv('MAIL_PROVIDER', '');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('SMTP_HOST', 'smtp.office365.com');
    vi.stubEnv('SMTP_USER', 'sender@example.com');
    vi.stubEnv('SMTP_PASS', 'test-password');
    vi.stubEnv('SMTP_FROM', 'sender@example.com');
    expect(getMailTransport().id).toBe('smtp');
  });

  it('selects Resend when explicitly configured', () => {
    vi.stubEnv('MAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('RESEND_FROM_EMAIL', 'notifications@mail.example.com');

    expect(getMailTransport().id).toBe('resend');
  });

  it('fails closed when Resend is selected but incomplete', async () => {
    vi.stubEnv('MAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESEND_FROM_EMAIL', '');

    const transport = getMailTransport();
    expect(transport.id).toBe('resend-misconfigured');
    await expect(
      transport.send({ to: 'participant@example.com', subject: 'Update', text: 'Body' }),
    ).rejects.toThrow('resend mail is selected');
  });

  it('prefers configured Resend when no provider is selected', () => {
    vi.stubEnv('MAIL_PROVIDER', '');
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('RESEND_FROM_EMAIL', 'notifications@mail.example.com');

    expect(getMailTransport().id).toBe('resend');
  });

  it('allows the log transport to be selected deliberately', () => {
    vi.stubEnv('MAIL_PROVIDER', 'log');
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('RESEND_FROM_EMAIL', 'notifications@mail.example.com');

    expect(getMailTransport().id).toBe('log');
  });

  it('fails closed for an unsupported explicit provider', async () => {
    vi.stubEnv('MAIL_PROVIDER', 'typo');
    vi.stubEnv('RESEND_API_KEY', 're_secret');
    vi.stubEnv('RESEND_FROM_EMAIL', 'notifications@mail.example.com');

    const transport = getMailTransport();
    expect(transport.id).toBe('typo-misconfigured');
    await expect(
      transport.send({ to: 'participant@example.com', subject: 'Update', text: 'Body' }),
    ).rejects.toThrow('typo mail is selected');
  });
});
