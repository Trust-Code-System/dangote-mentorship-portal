import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

// Maintenance mode is a single global feature flag (cohortId = null, per
// CLAUDE.md §3: null = global). When on, non-admin participants are locked out
// of the authenticated app and shown the /maintenance holding page, while
// admins keep full access so they can finish the work the window is for.
export const MAINTENANCE_FLAG_KEY = 'maintenance_mode';

/** Reads the global maintenance flag. Defaults to off when the row is absent. */
export const isMaintenanceMode = cache(async (): Promise<boolean> => {
  const flag = await prisma.featureFlag.findFirst({
    where: { key: MAINTENANCE_FLAG_KEY, cohortId: null, deletedAt: null },
    select: { enabled: true },
  });
  return flag?.enabled ?? false;
});
