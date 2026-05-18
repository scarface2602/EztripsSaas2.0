import { requireAuth } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { Inbox } from 'lucide-react';
import LeadsClient from './leads-client';

export default async function LeadsPage() {
  const { user } = await requireAuth();
  const supabase = createServiceClient();

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

  // Count active leads for limit display
  const activeCount = (myLeads || []).filter(l =>
    ['new', 'contacted', 'qualified'].includes(l.status as string)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Inbox className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Leads</h1>
      </div>
      <LeadsClient
        myLeads={myLeads || []}
        unassignedLeads={unassignedLeads || []}
        activeCount={activeCount}
        maxLeads={user.max_active_leads ?? 10}
      />
    </div>
  );
}
