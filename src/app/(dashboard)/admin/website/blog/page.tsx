import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { FileText } from 'lucide-react';
import BlogManager from './blog-manager';

export default async function BlogPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('website_blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Blog Posts</h1>
      </div>
      <BlogManager initialData={data || []} />
    </div>
  );
}
