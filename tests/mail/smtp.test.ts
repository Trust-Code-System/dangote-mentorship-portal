import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { createSmtpMailTransport, isSmtpMailConfigured, readSmtpMailConfig } from '@/lib/mail/smtp';

vi.mock('server-only', () => ({}));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));

const env = {
  SMTP_HOST: 'smtp.office365.com',
  SMTP_USER: 'sender@example.com',
  SMTP_PASS: ' secret with spaces ',
  SMTP_FROM: 'Programme <sender@example.com>',
};
const sendMail = vi.fn();

beforeEach(() => {
  vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as unknown as ReturnType<
    typeof nodemailer.createTransport
  >);
  sendMail.mockResolvedValue({ accepted: ['participant@example.com'], rejected: [] });
});
afterEach(() => vi.clearAllMocks());

describe('SMTP transport', () => {
  it('requires host, authenticated credentials and sender', () => {
    expect(isSmtpMailConfigured({})).toBe(false);
    for (const key of Object.keys(env)) {
      expect(isSmtpMailConfigured({ ...env, [key]: '' })).toBe(false);
    }
    expect(isSmtpMailConfigured(env)).toBe(true);
  });

  it.each(['0', '65536', '587.5', '587x', '-1', '1e3'])('rejects invalid port %s', (port) => {
    expect(isSmtpMailConfigured({ ...env, SMTP_PORT: port })).toBe(false);
  });

  it('requires STARTTLS on 587 and preserves the password exactly', async () => {
    const transport = createSmtpMailTransport({ ...env, SMTP_PORT: ' 587\r\n ' });
    await transport.send({
      to: 'participant@example.com',
      subject: 'Update',
      text: 'Plain body',
      html: '<p>Body</p>',
    });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        tls: { minVersion: 'TLSv1.2' },
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: env.SMTP_FROM,
      to: { address: 'participant@example.com', name: '' },
      subject: 'Update',
      text: 'Plain body',
      html: '<p>Body</p>',
    });
  });

  it('supports implicit TLS on 465 and trims dashboard boolean values', () => {
    expect(readSmtpMailConfig({ ...env, SMTP_PORT: '465' }).secure).toBe(true);
    expect(readSmtpMailConfig({ ...env, SMTP_SECURE: ' false\r\n ' }).secure).toBe(false);
    expect(isSmtpMailConfigured({ ...env, SMTP_REQUIRE_TLS: 'typo' })).toBe(false);
  });

  it('propagates failed authentication without leaking provider details', async () => {
    sendMail.mockRejectedValueOnce(new Error(`AUTH failed: ${env.SMTP_PASS}`));
    await expect(
      createSmtpMailTransport(env).send({
        to: 'participant@example.com',
        subject: 'Update',
        text: 'Body',
      }),
    ).rejects.toThrow(
      'SMTP mail delivery failed. Check the mailbox credentials and SMTP AUTH settings.',
    );
  });

  it.each([
    { accepted: [], rejected: ['participant@example.com'] },
    { accepted: [], rejected: [] },
  ])('does not mark a message sent without an accepted recipient', async (result) => {
    sendMail.mockResolvedValueOnce(result);
    await expect(
      createSmtpMailTransport(env).send({
        to: 'participant@example.com',
        subject: 'Update',
        text: 'Body',
      }),
    ).rejects.toThrow('SMTP mail delivery failed');
  });
});
