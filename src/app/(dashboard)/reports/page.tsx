import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { FileBarChart } from 'lucide-react';
import ReportsClient from './reports-client';

export default async function ReportsPage() {
  const { user } = await requireAuth();
  if (!['super_admin', 'manager', 'accounts'].includes(user.role)) {
    redirect('/');
  }

  const supabase = createServiceClient();
  const { data: agents } = await supabase
    .from('users')
    .select('id, full_name, role')
    .order('full_name');

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-2">
        <FileBarChart className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>
      <ReportsClient agents={(agents || []) as { id: string; full_name: string; role: string }[]} />
    </div>
  );
}
