import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PackageEditor from './PackageEditor';

export default async function EditPackagePage({ params }: { params: { id: string } }) {
  await requireSuperAdmin();

  if (params.id === 'new') {
    return <PackageEditor pkg={null} />;
  }

  const supabase = createServiceClient();
  const { data } = await supabase.from('website_packages').select('*').eq('id', params.id).single();
  if (!data) return notFound();

  return <PackageEditor pkg={data} />;
}
