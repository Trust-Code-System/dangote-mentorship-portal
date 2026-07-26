export type IntegrationMode = 'configured' | 'partial' | 'disabled';

export interface IntegrationHealthItem {
  mode: IntegrationMode;
  configured: boolean;
  missing: string[];
}

type Environment = Readonly<Record<string, string | undefined>>;

function microsoftIntegrationsEnabled(env: Environment): boolean {
  return env.MICROSOFT_INTEGRATIONS_ENABLED === 'true';
}

function groupHealth(env: Environment, names: string[]): IntegrationHealthItem {
  const present = names.filter((name) => Boolean(env[name]?.trim()));
  const missing = names.filter((name) => !env[name]?.trim());
  return {
    configured: missing.length === 0,
    mode: missing.length === 0 ? 'configured' : present.length === 0 ? 'disabled' : 'partial',
    missing,
  };
}

function graphHealth(env: Environment, names: string[], legacyNames: string[]) {
  const primary = groupHealth(env, names);
  if (primary.mode !== 'disabled') return primary;
  const legacy = groupHealth(env, legacyNames);
  return legacy.mode === 'disabled' ? primary : legacy;
}

export function getIntegrationHealth(env: Environment = process.env) {
  if (!microsoftIntegrationsEnabled(env)) {
    const disabled = { configured: false, mode: 'disabled' as const, missing: [] };
    return {
      entra: { ...disabled },
      graphMail: { ...disabled },
      graphCalendar: { ...disabled },
    };
  }

  return {
    entra: groupHealth(env, [
      'AUTH_MICROSOFT_ENTRA_ID_ID',
      'AUTH_MICROSOFT_ENTRA_ID_SECRET',
      'AUTH_MICROSOFT_ENTRA_ID_TENANT_ID',
    ]),
    graphMail: graphHealth(
      env,
      ['GRAPH_MAIL_TENANT_ID', 'GRAPH_MAIL_CLIENT_ID', 'GRAPH_MAIL_CLIENT_SECRET', 'GRAPH_MAIL_SENDER'],
      ['MAIL_GRAPH_TENANT_ID', 'MAIL_GRAPH_CLIENT_ID', 'MAIL_GRAPH_CLIENT_SECRET', 'MAIL_GRAPH_SENDER'],
    ),
    graphCalendar: graphHealth(
      env,
      ['GRAPH_CALENDAR_TENANT_ID', 'GRAPH_CALENDAR_CLIENT_ID', 'GRAPH_CALENDAR_CLIENT_SECRET'],
      ['MAIL_GRAPH_TENANT_ID', 'MAIL_GRAPH_CLIENT_ID', 'MAIL_GRAPH_CLIENT_SECRET'],
    ),
  };
}

export function integrationDiagnosticLines(env: Environment = process.env): string[] {
  return Object.entries(getIntegrationHealth(env)).map(([name, item]) =>
    `[integration] ${name}=${item.mode}${item.missing.length ? ` missing=${item.missing.join(',')}` : ''}`,
  );
}
