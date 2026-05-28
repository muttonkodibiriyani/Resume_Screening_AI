import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { apiHandler } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';

export const GET = apiHandler(async (_req, { params }) => {
  await requirePermission('candidate:read');
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      score: true,
      decision: { include: { decidedByUser: { select: { name: true } } } },
      benchmark: true,
    },
  });
  if (!candidate) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ candidate });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  const user = await requirePermission('candidate:delete');
  const c = await prisma.candidate.findUnique({ where: { id: params.id }, select: { id: true, fileName: true } });
  if (!c) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  await prisma.candidate.delete({ where: { id: params.id } });
  await logAudit({
    userId: user.id,
    action: 'CANDIDATE_DELETED',
    entityType: 'Candidate',
    entityId: params.id,
    details: { fileName: c.fileName },
    ipAddress: callerIp(),
  });
  return NextResponse.json({ ok: true });
});
