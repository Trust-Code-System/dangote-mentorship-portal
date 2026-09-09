import { describe, expect, it } from 'vitest';
import { getIntegrationHealth, integrationDiagnosticLines } from '@/lib/integrations/health';

describe('integration health', () => {
  it('reports Resend independently of the Microsoft integrations switch', () => {
    const health = getIntegrationHealth({
      RESEND_API_KEY: 're_secret',
      RESEND_FROM_EMAIL: 'Programme <notifications@mail.example.com>',
    });

    expect(health.resend.mode).toBe('configured');
    expect(health.graphMail.mode).toBe('disabled');
  });

  it('keeps Entra, Graph mail, and Graph calendar independently configurable', () => {
    const health = getIntegrationHealth({
      MICROSOFT_INTEGRATIONS_ENABLED: 'true',
      AUTH_MICROSOFT_ENTRA_ID_ID: 'entra-client',
      AUTH_MICROSOFT_ENTRA_ID_SECRET: 'entra-secret',
      AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: 'entra-tenant',
      GRAPH_MAIL_TENANT_ID: 'mail-tenant',
      GRAPH_MAIL_CLIENT_ID: 'mail-client',
      GRAPH_MAIL_CLIENT_SECRET: 'mail-secret',
      GRAPH_MAIL_SENDER: 'sender@example.test',
    });

    expect(health.entra.mode).toBe('configured');
    expect(health.graphMail.mode).toBe('configured');
    expect(health.graphCalendar.mode).toBe('disabled');
  });

  it('reports partial configuration by variable name without exposing values', () => {
    const env = {
      MICROSOFT_INTEGRATIONS_ENABLED: 'true',
      GRAPH_CALENDAR_CLIENT_ID: 'sensitive-client-value',
    };
    const health = getIntegrationHealth(env);
    const diagnostics = integrationDiagnosticLines(env).join('\n');

    expect(health.graphCalendar.mode).toBe('partial');
    expect(health.graphCalendar.missing).toEqual([
      'GRAPH_CALENDAR_TENANT_ID',
      'GRAPH_CALENDAR_CLIENT_SECRET',
    ]);
    expect(diagnostics).toContain('GRAPH_CALENDAR_TENANT_ID');
    expect(diagnostics).not.toContain('sensitive-client-value');
  });

  it('accepts the documented legacy Graph mail variables as a fallback', () => {
    const health = getIntegrationHealth({
      MICROSOFT_INTEGRATIONS_ENABLED: 'true',
      MAIL_GRAPH_TENANT_ID: 'tenant',
      MAIL_GRAPH_CLIENT_ID: 'client',
      MAIL_GRAPH_CLIENT_SECRET: 'secret',
      MAIL_GRAPH_SENDER: 'sender@example.test',
    });

    expect(health.graphMail.mode).toBe('configured');
    expect(health.graphCalendar.mode).toBe('configured');
  });

  it('prompts with the current Graph names when neither naming scheme is present', () => {
    const health = getIntegrationHealth({ MICROSOFT_INTEGRATIONS_ENABLED: 'true' });

    expect(health.graphMail.missing).toContain('GRAPH_MAIL_TENANT_ID');
    expect(health.graphCalendar.missing).toContain('GRAPH_CALENDAR_TENANT_ID');
    expect(health.graphMail.missing).not.toContain('MAIL_GRAPH_TENANT_ID');
  });

  it('fails closed while the owner keeps Microsoft integrations disabled', () => {
    const health = getIntegrationHealth({
      AUTH_MICROSOFT_ENTRA_ID_ID: 'entra-client',
      AUTH_MICROSOFT_ENTRA_ID_SECRET: 'entra-secret',
      AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: 'entra-tenant',
      GRAPH_MAIL_TENANT_ID: 'mail-tenant',
      GRAPH_MAIL_CLIENT_ID: 'mail-client',
      GRAPH_MAIL_CLIENT_SECRET: 'mail-secret',
      GRAPH_MAIL_SENDER: 'sender@example.test',
    });

    expect(health.entra.mode).toBe('disabled');
    expect(health.graphMail.mode).toBe('disabled');
    expect(health.graphCalendar.mode).toBe('disabled');
  });
});

// Production stored this flag with a trailing CRLF inside the value, which a
// strict equality check reads as OFF — leaving mail on the log transport with
// nothing to explain why no message is delivered. These pin the trim.
describe('MICROSOFT_INTEGRATIONS_ENABLED tolerance', () => {
  const mailVars = {
    GRAPH_MAIL_TENANT_ID: 't',
    GRAPH_MAIL_CLIENT_ID: 'c',
    GRAPH_MAIL_CLIENT_SECRET: 's',
    GRAPH_MAIL_SENDER: 'noreply@example.com',
  };

  it('enables integrations for a plain "true"', () => {
    const health = getIntegrationHealth({ MICROSOFT_INTEGRATIONS_ENABLED: 'true', ...mailVars });
    expect(health.graphMail.configured).toBe(true);
  });

  it('enables integrations despite a trailing newline', () => {
    const health = getIntegrationHealth({
      MICROSOFT_INTEGRATIONS_ENABLED: 'true\r\n',
      ...mailVars,
    });
    expect(health.graphMail.configured).toBe(true);
  });

  it('enables integrations despite surrounding spaces', () => {
    const health = getIntegrationHealth({
      MICROSOFT_INTEGRATIONS_ENABLED: '  true  ',
      ...mailVars,
    });
    expect(health.graphMail.configured).toBe(true);
  });

  it('stays disabled for "false" with a trailing newline (the production value)', () => {
    const health = getIntegrationHealth({
      MICROSOFT_INTEGRATIONS_ENABLED: 'false\r\n',
      ...mailVars,
    });
    expect(health.graphMail.configured).toBe(false);
    expect(health.graphMail.mode).toBe('disabled');
  });

  it('stays disabled when the flag is absent, even with every mail var set', () => {
    expect(getIntegrationHealth({ ...mailVars }).graphMail.configured).toBe(false);
  });

  it('does not treat a non-"true" word as enabled', () => {
    for (const value of ['1', 'yes', 'TRUE', 'enabled']) {
      const health = getIntegrationHealth({ MICROSOFT_INTEGRATIONS_ENABLED: value, ...mailVars });
      expect(health.graphMail.configured, value).toBe(false);
    }
  });

  it('reports exactly which mail variables are missing once enabled', () => {
    const health = getIntegrationHealth({
      MICROSOFT_INTEGRATIONS_ENABLED: 'true',
      GRAPH_MAIL_TENANT_ID: 't',
      GRAPH_MAIL_CLIENT_ID: 'c',
    });
    expect(health.graphMail.mode).toBe('partial');
    expect(health.graphMail.missing).toEqual(['GRAPH_MAIL_CLIENT_SECRET', 'GRAPH_MAIL_SENDER']);
  });
});
