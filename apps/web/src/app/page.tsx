import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const result = await getServerSession();
  redirect(result.status === 'ok' ? '/employees' : '/login');
}
