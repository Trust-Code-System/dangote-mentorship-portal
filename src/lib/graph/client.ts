import 'server-only';

// Shared Microsoft Graph app-only (client-credentials) auth. Dangote runs on
// Entra/Outlook, so both outbound mail (lib/mail) and calendar writes
// (lib/meetings) authenticate against the same app registration. The token is
// cached and reused across callers (CLAUDE.md §2, §14: never log secrets).

const TOKEN_HOST = 'https://login.microsoftonline.com';
export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface GraphMailConfig extends GraphConfig {
  sender: string;
}

export function readGraphMailConfig(): GraphMailConfig {
  return {
    tenantId: (process.env.GRAPH_MAIL_TENANT_ID ?? process.env.MAIL_GRAPH_TENANT_ID) as string,
    clientId: (process.env.GRAPH_MAIL_CLIENT_ID ?? process.env.MAIL_GRAPH_CLIENT_ID) as string,
    clientSecret: (process.env.GRAPH_MAIL_CLIENT_SECRET ?? process.env.MAIL_GRAPH_CLIENT_SECRET) as string,
    sender: (process.env.GRAPH_MAIL_SENDER ?? process.env.MAIL_GRAPH_SENDER) as string,
  };
}

export function readGraphCalendarConfig(): GraphConfig {
  return {
    tenantId: (process.env.GRAPH_CALENDAR_TENANT_ID ?? process.env.MAIL_GRAPH_TENANT_ID) as string,
    clientId: (process.env.GRAPH_CALENDAR_CLIENT_ID ?? process.env.MAIL_GRAPH_CLIENT_ID) as string,
    clientSecret: (process.env.GRAPH_CALENDAR_CLIENT_SECRET ?? process.env.MAIL_GRAPH_CLIENT_SECRET) as string,
  };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

// Cache the app token across calls; refresh a minute before it actually expires.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getGraphToken(config: GraphConfig): Promise<string> {
  const cacheKey = `${config.tenantId}:${config.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(`${TOKEN_HOST}/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Status only — never log the secret or response body (CLAUDE.md §14).
    throw new Error(`Graph token request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
  });
  return data.access_token;
}

/** Test-only: reset the cached app token between cases. */
export function resetGraphTokenCache(): void {
  tokenCache.clear();
}
