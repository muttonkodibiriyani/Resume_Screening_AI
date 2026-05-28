import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { apiHandler } from '@/lib/api';
import { getOrSetCsrfToken } from '@/lib/csrf';

export const GET = apiHandler(async () => {
  const u = await getSession();
  // Stamp/return CSRF so the client can read it
  const csrf = getOrSetCsrfToken();
  return NextResponse.json({ user: u, csrfToken: csrf });
});
