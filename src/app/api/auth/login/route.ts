import { NextResponse } from 'next/server';
import { login, callerIp } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { apiHandler, parseJson } from '@/lib/api';
import { loginSchema } from '@/lib/validation/schemas';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const POST = apiHandler(async (req) => {
  const ip = callerIp();
  const rl = rateLimit(ip, LIMITS.login);
  if (!rl.allowed) {
    await logAudit({ action: 'LOGIN_RATE_LIMITED', ipAddress: ip });
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  const { email, password } = await parseJson(req, loginSchema);
  const user = await login(email, password);

  if (!user) {
    await logAudit({ action: 'LOGIN_FAILED', details: { email }, ipAddress: ip });
    return NextResponse.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  await logAudit({ userId: user.id, action: 'LOGIN_SUCCESS', ipAddress: ip });
  return NextResponse.json({ user });
});
