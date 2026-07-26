import { describe, expect, it } from 'vitest';
import { getIntegrationHealth, integrationDiagnosticLines } from '@/lib/integrations/health';

describe('integration health', () => {
  it('keeps Entra, Graph mail, and Graph calendar independently configurable', () => {
    const health = getIntegrationHealth({
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
      MAIL_GRAPH_TENANT_ID: 'tenant',
      MAIL_GRAPH_CLIENT_ID: 'client',
      MAIL_GRAPH_CLIENT_SECRET: 'secret',
      MAIL_GRAPH_SENDER: 'sender@example.test',
    });

    expect(health.graphMail.mode).toBe('configured');
    expect(health.graphCalendar.mode).toBe('configured');
  });

  it('prompts with the current Graph names when neither naming scheme is present', () => {
    const health = getIntegrationHealth({});

    expect(health.graphMail.missing).toContain('GRAPH_MAIL_TENANT_ID');
    expect(health.graphCalendar.missing).toContain('GRAPH_CALENDAR_TENANT_ID');
    expect(health.graphMail.missing).not.toContain('MAIL_GRAPH_TENANT_ID');
  });
});
