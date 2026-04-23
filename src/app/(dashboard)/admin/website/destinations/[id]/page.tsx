import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import DestinationDetail from './DestinationDetail';

export default async function EditDestinationPage({ params }: { params: { id: string } }) {
  await requireSuperAdmin();

  if (params.id === 'new') {
    return <DestinationDetail destination={null} packages={[]} />;
  }

  const supabase = createServiceClient();
  const { data: destination } = await supabase
    .from('website_destinations')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!destination) return notFound();

  const { data: packages } = await supabase
    .from('website_packages')
    .select('*')
    .eq('destination_slug', destination.slug)
    .order('sort_order');

  return <DestinationDetail destination={destination} packages={packages || []} />;
}
