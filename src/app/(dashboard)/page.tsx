import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';
import type { Proposal } from '@/lib/types/database';

export interface DashboardEnquiry {
  id: string;
  query_id?: string | null;
  name: string | null;
  destination: string | null;
  travel_date: string | null;
  adults: number | null;
  children: number | null;
  source: string | null;
  status: string;
  created_at: string;
}

export interface FollowUpEnquiry {
  id: string;
  name: string | null;
  destination: string | null;
  follow_up_date: string;
  status: string;
}

export default async function DashboardPage() {
  await requireAuth();
  const supabase = await createClient();

  let proposals: Proposal[] = [];
  let receivables: Record<string, unknown>[] = [];
  let payables: Record<string, unknown>[] = [];
  let newEnquiryCount = 0;
  let recentEnquiries: DashboardEnquiry[] = [];
  let todayFollowUps: FollowUpEnquiry[] = [];
  let overdueFollowUpCount = 0;

  const today = new Date().toISOString().split('T')[0];

  try {
    const [proposalsRes, receivablesRes, payablesRes, enquiryCountRes, recentEnquiriesRes, todayFollowUpsRes, overdueFollowUpsRes] = await Promise.all([
      supabase.from('proposals').select('*, clients(full_name)').order('created_at', { ascending: false }),
      supabase.from('booking_package_payments').select('id, amount, amount_paid, status').in('status', ['pending', 'due']),
      supabase.from('booking_items').select('id, cost_price').not('supplier_id', 'is', null).not('supplier_status', 'in', '("completed","cancelled")'),
      supabase.from('website_enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('website_enquiries').select('id, query_id, name, destination, travel_date, adults, children, source, status, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('website_enquiries').select('id, name, destination, follow_up_date, status').lte('follow_up_date', today).not('status', 'in', '("won","lost","spam")'),
      supabase.from('website_enquiries').select('id', { count: 'exact', head: true }).lt('follow_up_date', today).not('status', 'in', '("won","lost","spam")'),
    ]);

    proposals = (proposalsRes.data || []) as Proposal[];
    receivables = (receivablesRes.data || []) as Record<string, unknown>[];
    payables = (payablesRes.data || []) as Record<string, unknown>[];
    newEnquiryCount = (enquiryCountRes.count ?? 0);
    recentEnquiries = (recentEnquiriesRes.data || []) as DashboardEnquiry[];
    todayFollowUps = (todayFollowUpsRes.data || []) as FollowUpEnquiry[];
    overdueFollowUpCount = (overdueFollowUpsRes.count ?? 0);
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
      todayFollowUps={todayFollowUps}
      overdueFollowUpCount={overdueFollowUpCount}
    />
  );
}
