import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loadResume } from '@/lib/storage';
import { apiHandler } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';

export const GET = apiHandler(async (_req, { params }) => {
  const user = await requirePermission('candidate:read');
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    select: { id: true, fileName: true, filePath: true, fileType: true },
  });
  if (!candidate) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  if (!candidate.filePath) {
    return NextResponse.json({ error: 'Original file not stored', code: 'NOT_STORED' }, { status: 404 });
  }

  const loaded = await loadResume(candidate.filePath);
  if (!loaded) return NextResponse.json({ error: 'File missing in storage', code: 'NOT_FOUND' }, { status: 404 });

  await logAudit({
    userId: user.id,
    action: 'RESUME_DOWNLOADED',
    entityType: 'Candidate',
    entityId: candidate.id,
    ipAddress: callerIp(),
  });

  return new NextResponse(loaded.buffer as BodyInit, {
    headers: {
      'Content-Type': loaded.contentType,
      'Content-Disposition': `attachment; filename="${candidate.fileName.replace(/"/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=300',
    },
  });
});
