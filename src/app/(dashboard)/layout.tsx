import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from './sidebar';
import type { User } from '@/lib/types/database';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user: User | null = null;

  const supabase = await createClient();

  // Step 1: check authentication
  let authUser;
  try {
    const { data } = await supabase.auth.getUser();
    authUser = data.user;
  } catch (e) {
    console.error('Dashboard layout auth error:', e);
  }

  if (!authUser) {
    redirect('/login');
  }

  // Step 2: fetch user profile — do NOT redirect to /login on failure
  // (that creates a redirect loop because middleware sees valid cookies
  //  and sends authenticated users back to /)
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    user = (data as User) ?? null;
  } catch (e) {
    console.error('Failed to fetch user profile:', e);
  }

  // Fallback: if the users row is missing or the query failed, build
  // a minimal User from the auth record so the shell still renders.
  if (!user) {
    user = {
      id: authUser.id,
      email: authUser.email ?? '',
      full_name: authUser.email ?? 'User',
      role: 'agent' as const,
      agency_name: null,
      logo_url: null,
      whatsapp_number: null,
      default_currency: 'INR',
      default_payment_terms: null,
      margin_threshold_pct: 12,
      rounding_unit: 0,
      tc_content: null,
      tc_version: 1,
      created_at: new Date().toISOString(),
    } as User;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
