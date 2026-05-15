import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';
import type { Proposal } from '@/lib/types/database';

export interface DashboardEnquiry {
  id: string;
  client_name: string | null;
  destination: string | null;
  travel_dates: string | null;
  pax: string | null;
  source: string | null;
  status: string;
  created_at: string;
}

export default async function DashboardPage() {
  await requireAuth();
  const supabase = await createClient();

  let proposals: Proposal[] = [];
  let receivables: Record<string, unknown>[] = [];
  let payables: Record<string, unknown>[] = [];
  let newEnquiryCount = 0;
  let recentEnquiries: DashboardEnquiry[] = [];

  try {
    const [proposalsRes, receivablesRes, payablesRes, enquiryCountRes, recentEnquiriesRes] = await Promise.all([
      supabase.from('proposals').select('*, clients(full_name)').order('created_at', { ascending: false }),
      supabase.from('receivables').select('*').eq('status', 'pending'),
      supabase.from('payables').select('*').eq('status', 'pending'),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('enquiries').select('id, client_name, destination, travel_dates, pax, source, status, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    proposals = (proposalsRes.data || []) as Proposal[];
    receivables = (receivablesRes.data || []) as Record<string, unknown>[];
    payables = (payablesRes.data || []) as Record<string, unknown>[];
    newEnquiryCount = (enquiryCountRes.count ?? 0);
    recentEnquiries = (recentEnquiriesRes.data || []) as DashboardEnquiry[];
  } catch (e) {
    console.error('Dashboard data fetch error:', e);
  }

  return (
    <DashboardClient
      proposals={proposals}
      receivables={receivables}
      payables={payables}
      newEnquiryCount={newEnquiryCount}
      recentEnquiries={recentEnquiries}
    />
  );
}
