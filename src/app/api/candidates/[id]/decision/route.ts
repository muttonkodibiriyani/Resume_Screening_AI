import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { apiHandler, parseJson } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { decisionSchema } from '@/lib/validation/schemas';

export const POST = apiHandler(async (req, { params }) => {
  const user = await requirePermission('decision:write');
  const { decision, comments } = await parseJson(req, decisionSchema);
  const candidateId = params.id!;

  const saved = await prisma.decision.upsert({
    where: { candidateId },
    update: { decision, comments: comments ?? null, decidedBy: user.id, decidedAt: new Date() },
    create: { candidateId, decision, comments: comments ?? null, decidedBy: user.id },
  });

  await logAudit({
    userId: user.id,
    action: 'DECISION_UPDATED',
    entityType: 'Candidate',
    entityId: params.id,
    details: { decision, comments },
    ipAddress: callerIp(),
  });

  return NextResponse.json({ decision: saved });
});
