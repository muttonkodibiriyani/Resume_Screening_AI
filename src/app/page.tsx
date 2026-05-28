import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Home() {
  const u = await getSession();
  if (u) redirect('/dashboard');
  redirect('/login');
}
