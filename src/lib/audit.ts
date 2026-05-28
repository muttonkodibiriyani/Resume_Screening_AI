import { prisma } from './db';
import { logger } from './logger';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string;
}

export async function logAudit(opts: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId || null,
        action: opts.action,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        details: opts.details ? JSON.stringify(opts.details) : null,
        ipAddress: opts.ipAddress ?? null,
      },
    });
  } catch (e) {
    logger.error('audit log write failed', { error: String(e), action: opts.action });
  }
}
