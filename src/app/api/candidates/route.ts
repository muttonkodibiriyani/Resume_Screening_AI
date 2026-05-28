import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiHandler, parseQuery } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { candidatesQuerySchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req) => {
  await requirePermission('candidate:read');
  const { benchmarkId, search } = parseQuery(req, candidatesQuerySchema);

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(benchmarkId ? { benchmarkId } : {}),
      ...(search
        ? {
            OR: [
              { candidateName: { contains: search } },
              { email: { contains: search } },
              { fileName: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      score: true,
      decision: true,
      benchmark: { select: { roleTitle: true, skillFamily: true } },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return NextResponse.json({ candidates });
});
