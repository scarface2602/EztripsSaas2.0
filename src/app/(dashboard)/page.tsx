import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';
import type { Proposal } from '@/lib/types/database';

export default async function DashboardPage() {
  await requireAuth();
  const supabase = await createClient();

  let proposals: Proposal[] = [];
  let receivables: Record<string, unknown>[] = [];
  let payables: Record<string, unknown>[] = [];

  try {
    const [proposalsRes, receivablesRes, payablesRes] = await Promise.all([
      supabase.from('proposals').select('*, clients(full_name)').order('created_at', { ascending: false }),
      supabase.from('receivables').select('*').eq('status', 'pending'),
      supabase.from('payables').select('*').eq('status', 'pending'),
    ]);

    proposals = (proposalsRes.data || []) as Proposal[];
    receivables = (receivablesRes.data || []) as Record<string, unknown>[];
    payables = (payablesRes.data || []) as Record<string, unknown>[];
  } catch (e) {
    console.error('Dashboard data fetch error:', e);
  }

  return (
    <DashboardClient
      proposals={proposals}
      receivables={receivables}
      payables={payables}
    />
  );
}
