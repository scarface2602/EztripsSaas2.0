import { requireAuth } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { Inbox } from 'lucide-react';
import LeadsClient from './leads-client';
import { actionNeededSort } from '@/lib/leads/sort';

export default async function LeadsPage() {
  const { user } = await requireAuth();
  const supabase = createServiceClient();
  const isAdmin = user.role === 'super_admin' || user.role === 'manager';

  if (isAdmin) {
    // Admin/manager: fetch ALL enquiries + agents list + proposal counts
    const [{ data: enquiries }, { data: agents }, { data: proposalCounts }] = await Promise.all([
      supabase
        .from('website_enquiries')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('id, full_name, role, max_active_leads')
        .neq('role', 'admin'),
      supabase
        .from('proposals')
        .select('enquiry_id')
        .not('enquiry_id', 'is', null),
    ]);

    const countMap: Record<string, number> = {};
    (proposalCounts || []).forEach((p) => {
      const eid = p.enquiry_id as string;
      countMap[eid] = (countMap[eid] || 0) + 1;
    });

    const enriched = actionNeededSort(
      (enquiries || []).map((e) => ({
        ...e,
        proposal_count: countMap[e.id as string] || 0,
      })),
    );

    return (
      <div className="space-y-6 min-w-0">
        <div className="flex items-center gap-2">
          <Inbox className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Enquiries</h1>
        </div>
        <LeadsClient
          role={user.role}
          allEnquiries={enriched}
          agents={(agents || []) as { id: string; full_name: string; role: string; max_active_leads: number }[]}
        />
      </div>
    );
  }

  // Agent view: my leads + unassigned pool
  const [{ data: myLeads }, { data: unassignedLeads }] = await Promise.all([
    supabase
      .from('website_enquiries')
      .select('*')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('website_enquiries')
      .select('*')
      .is('assigned_to', null)
      .in('status', ['new', 'contacted', 'qualified'])
      .order('created_at', { ascending: false }),
  ]);

  const activeCount = (myLeads || []).filter(l =>
    ['new', 'contacted', 'qualified'].includes(l.status as string)
  ).length;

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-2">
        <Inbox className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Enquiries</h1>
      </div>
      <LeadsClient
        role={user.role}
        myLeads={actionNeededSort(myLeads || [])}
        unassignedLeads={actionNeededSort(unassignedLeads || [])}
        activeCount={activeCount}
        maxLeads={user.max_active_leads ?? 10}
      />
    </div>
  );
}
