import { NextResponse } from 'next/server';
import { logout, getSession, callerIp } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { apiHandler } from '@/lib/api';

export const POST = apiHandler(async () => {
  const u = await getSession();
  if (u) await logAudit({ userId: u.id, action: 'LOGOUT', ipAddress: callerIp() });
  await logout();
  return NextResponse.json({ ok: true });
});
