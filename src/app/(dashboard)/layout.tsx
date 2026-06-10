import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar, MobileHeader } from './sidebar';
import type { User } from '@/lib/types/database';
import { Toaster } from '@/components/ui/sonner';

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

  // Fetch overdue follow-up count for sidebar badge
  let overdueFollowUps = 0;
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('website_enquiries')
      .select('id', { count: 'exact', head: true })
      .lt('follow_up_date', today)
      .not('status', 'in', '("won","lost","spam")');
    overdueFollowUps = count ?? 0;
  } catch {
    // ignore
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} overdueFollowUps={overdueFollowUps} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader user={user} overdueFollowUps={overdueFollowUps} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/30">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
