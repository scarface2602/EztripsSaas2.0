import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { MapPin } from 'lucide-react';
import DestinationsManager from './destinations-manager';

export default async function DestinationsPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('website_destinations')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Website Destinations</h1>
      </div>
      <DestinationsManager initialData={data || []} />
    </div>
  );
}
