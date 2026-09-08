// Microsoft integrations are deliberately fail-closed. They stay disabled until
// the owner both configures credentials and explicitly opts in with this flag.
// This avoids accidentally activating tenant-scoped services if credentials are
// present in a copied environment.
export function areMicrosoftIntegrationsEnabled(
  env: Readonly<NodeJS.ProcessEnv> = process.env,
): boolean {
  return env.MICROSOFT_INTEGRATIONS_ENABLED === 'true';
}

// Microsoft Entra ID is registered only when Microsoft integrations are opted
// in and its full tenant credential set exists. Until then the login page hides
// the SSO button instead of showing one that errors.
export function isEntraConfigured(): boolean {
  return Boolean(
    areMicrosoftIntegrationsEnabled() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
  );
}
