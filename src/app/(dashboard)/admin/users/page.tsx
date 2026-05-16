import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import type { User } from '@/lib/types/database';
import { UsersManager } from './users-manager';

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  const { data: users } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  return <UsersManager initialUsers={(users || []) as User[]} />;
}
