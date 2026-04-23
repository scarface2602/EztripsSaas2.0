import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { Inbox } from 'lucide-react';
import EnquiriesTable from './enquiries-table';

export default async function EnquiriesPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('website_enquiries')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Inbox className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Website Enquiries</h1>
      </div>
      <EnquiriesTable initialData={data || []} />
    </div>
  );
}
