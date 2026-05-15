import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import PagesManager from './pages-manager';

export default async function PagesPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('website_pages')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  return <PagesManager initialData={data || []} />;
}
