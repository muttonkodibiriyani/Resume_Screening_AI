import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiHandler, parseQuery } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { auditQuerySchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req) => {
  await requirePermission('audit:read');
  const { limit, userId, action } = parseQuery(req, auditQuerySchema);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { name: true, email: true, role: true } } },
  });

  return NextResponse.json({ logs });
});
