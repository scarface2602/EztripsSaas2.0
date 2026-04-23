import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { MapPin } from 'lucide-react';
import DestinationsManager from './destinations-manager';

export default async function DestinationsPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  const { data: destinations } = await supabase
    .from('website_destinations')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  // Get package counts per destination_slug
  const { data: packages } = await supabase
    .from('website_packages')
    .select('destination_slug');

  const packageCounts: Record<string, number> = {};
  (packages || []).forEach(p => {
    const slug = p.destination_slug as string;
    if (slug) packageCounts[slug] = (packageCounts[slug] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Destinations & Packages</h1>
      </div>
      <p className="text-muted-foreground">Manage your destinations and the packages under each one. Click a destination to edit it and manage its packages.</p>
      <DestinationsManager initialData={destinations || []} packageCounts={packageCounts} />
    </div>
  );
}
