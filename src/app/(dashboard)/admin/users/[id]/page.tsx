import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { User } from '@/lib/types/database';
import { AgentDetailClient } from './agent-detail-client';

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: agent } = await supabase.from('users').select('*').eq('id', id).single();
  if (!agent) notFound();

  // Fetch agent's data
  const [proposalsRes, clientsRes, receivablesRes, payablesRes, bookingsRes] = await Promise.all([
    supabase.from('proposals').select('*, clients(full_name)').eq('created_by', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('clients').select('*').eq('created_by', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('receivables').select('*, proposals(title, destination)').eq('created_by', id),
    supabase.from('payables').select('*, suppliers(name)').eq('created_by', id),
    supabase.from('bookings').select('*, proposals(title, destination), suppliers(name)').eq('created_by', id).order('created_at', { ascending: false }).limit(10),
  ]);

  const proposals = proposalsRes.data || [];
  const clients = clientsRes.data || [];
  const receivables = receivablesRes.data || [];
  const payables = payablesRes.data || [];
  const bookings = bookingsRes.data || [];

  return (
    <AgentDetailClient
      agent={agent as User}
      proposals={proposals}
      clients={clients}
      receivables={receivables}
      payables={payables}
      bookings={bookings}
    />
  );
}
