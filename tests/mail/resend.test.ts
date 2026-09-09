import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResendMailTransport, isResendMailConfigured } from '@/lib/mail/resend';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Resend mail transport', () => {
  it('requires both an API key and a verified sender', () => {
    expect(isResendMailConfigured({})).toBe(false);
    expect(isResendMailConfigured({ RESEND_API_KEY: 're_test' })).toBe(false);
    expect(
      isResendMailConfigured({
        RESEND_API_KEY: ' re_test ',
        RESEND_FROM_EMAIL: ' Programme <notifications@mail.example.com> ',
      }),
    ).toBe(true);
  });

  it('sends the complete message without exposing the API key in the payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const transport = createResendMailTransport({
      RESEND_API_KEY: 're_secret',
      RESEND_FROM_EMAIL: 'Programme <notifications@mail.example.com>',
    });

    await transport.send({
      to: 'participant@example.com',
      subject: 'Programme update',
      text: 'Plain update',
      html: '<p>Programme update</p>',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ authorization: 'Bearer re_secret' });
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'Programme <notifications@mail.example.com>',
      to: ['participant@example.com'],
      subject: 'Programme update',
      text: 'Plain update',
      html: '<p>Programme update</p>',
    });
    expect(String(init.body)).not.toContain('re_secret');
  });

  it('fails delivery when Resend rejects the request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const transport = createResendMailTransport({
      RESEND_API_KEY: 're_secret',
      RESEND_FROM_EMAIL: 'notifications@mail.example.com',
    });

    await expect(
      transport.send({ to: 'participant@example.com', subject: 'Update', text: 'Body' }),
    ).rejects.toThrow('Resend mail delivery failed (HTTP 403).');
  });
});
