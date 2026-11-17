import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

// Every mutation writes an audit_logs row (CLAUDE.md §3, §14). Keep metadata
// free of message content / sensitive PII.
export interface AuditInput {
  actorId?: string | null;
  cohortId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAuditLog(
  input: AuditInput,
  client: Pick<Prisma.TransactionClient, 'auditLog'> = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      cohortId: input.cohortId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as object | undefined,
    },
  });
}
