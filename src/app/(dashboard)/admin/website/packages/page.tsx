import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { Package } from 'lucide-react';
import PackagesManager from './packages-manager';

export default async function PackagesPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('website_packages')
    .select('*')
    .order('sort_order');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Packages</h1>
      </div>
      <PackagesManager initialData={data || []} />
    </div>
  );
}
