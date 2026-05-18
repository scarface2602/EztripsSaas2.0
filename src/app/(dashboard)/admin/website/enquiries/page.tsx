import { requireManagerOrAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { Inbox } from 'lucide-react';
import EnquiriesTable from './enquiries-table';

export default async function EnquiriesPage() {
  await requireManagerOrAdmin();
  const supabase = createServiceClient();

  const [{ data: enquiries }, { data: proposalCounts }, { data: agents }] = await Promise.all([
    supabase
      .from('website_enquiries')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('proposals')
      .select('enquiry_id')
      .not('enquiry_id', 'is', null),
    supabase
      .from('users')
      .select('id, full_name, role, max_active_leads')
      .in('role', ['agent', 'manager']),
  ]);

  // Build a count map: enquiry_id → number of linked proposals
  const countMap: Record<string, number> = {};
  (proposalCounts || []).forEach((p) => {
    const eid = p.enquiry_id as string;
    countMap[eid] = (countMap[eid] || 0) + 1;
  });

  // Attach proposal_count to each enquiry
  const enriched = (enquiries || []).map((e) => ({
    ...e,
    proposal_count: countMap[e.id as string] || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Inbox className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Website Enquiries</h1>
      </div>
      <EnquiriesTable initialData={enriched} agents={(agents || []) as { id: string; full_name: string; role: string; max_active_leads: number }[]} />
    </div>
  );
}
