import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { apiHandler, parseJson } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { benchmarkUpdateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (_req, { params }) => {
  await requirePermission('benchmark:read');
  const benchmark = await prisma.benchmark.findUnique({
    where: { id: params.id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!benchmark) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ benchmark });
});

export const PATCH = apiHandler(async (req, { params }) => {
  const body = await parseJson(req, benchmarkUpdateSchema);

  // approve and bump_version need higher privileges
  if (body.approvalStatus === 'approved') {
    await requirePermission('benchmark:approve');
  } else if (body.bumpVersion) {
    await requirePermission('benchmark:bump_version');
  } else {
    await requirePermission('benchmark:update');
  }
  const user = await requirePermission('benchmark:update');

  const existing = await prisma.benchmark.findUnique({ where: { id: params.id }, select: { version: true } });
  if (!existing) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  const updated = await prisma.benchmark.update({
    where: { id: params.id },
    data: {
      ...(body.approvalStatus ? { approvalStatus: body.approvalStatus } : {}),
      ...(body.idealSummary ? { idealSummary: body.idealSummary } : {}),
      ...(body.weights ? { weights: JSON.stringify(body.weights) } : {}),
      ...(body.bumpVersion ? { version: existing.version + 1, approvalStatus: 'draft' } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    action:
      body.approvalStatus === 'approved'
        ? 'BENCHMARK_APPROVED'
        : body.bumpVersion
          ? 'BENCHMARK_VERSION_BUMPED'
          : 'BENCHMARK_UPDATED',
    entityType: 'Benchmark',
    entityId: params.id,
    details: body,
    ipAddress: callerIp(),
  });

  return NextResponse.json({ benchmark: updated });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  const user = await requirePermission('benchmark:delete');
  await prisma.benchmark.delete({ where: { id: params.id } });
  await logAudit({
    userId: user.id,
    action: 'BENCHMARK_DELETED',
    entityType: 'Benchmark',
    entityId: params.id,
    ipAddress: callerIp(),
  });
  return NextResponse.json({ ok: true });
});
