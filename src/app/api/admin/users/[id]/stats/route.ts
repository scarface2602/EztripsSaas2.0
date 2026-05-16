import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireApiAdmin } from '@/lib/auth/require-api-admin';

// GET — fetch full stats for a specific agent (simulated dashboard)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireApiAdmin();
  if (check instanceof NextResponse) return check;

  const { id: agentId } = await params;
  const supabase = createServiceClient();

  // Verify user exists
  const { data: agent } = await supabase.from('users').select('*').eq('id', agentId).single();
  if (!agent) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Fetch all agent data in parallel
  const [proposalsRes, clientsRes, receivablesRes, payablesRes, bookingsRes] = await Promise.all([
    supabase.from('proposals').select('*, clients(full_name)').eq('created_by', agentId).order('created_at', { ascending: false }),
    supabase.from('clients').select('*').eq('created_by', agentId).order('created_at', { ascending: false }),
    supabase.from('receivables').select('*, proposals(title, destination)').eq('created_by', agentId),
    supabase.from('payables').select('*, suppliers(name)').eq('created_by', agentId),
    supabase.from('bookings').select('*, proposals(title, destination), suppliers(name)').eq('created_by', agentId).order('created_at', { ascending: false }),
  ]);

  const proposals = proposalsRes.data || [];
  const clients = clientsRes.data || [];
  const receivables = receivablesRes.data || [];
  const payables = payablesRes.data || [];
  const bookings = bookingsRes.data || [];

  // Compute stats
  const statusCounts: Record<string, number> = {};
  proposals.forEach((p: Record<string, unknown>) => {
    const s = p.status as string;
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const pendingReceivables = receivables.filter((r: Record<string, unknown>) => r.status === 'pending');
  const pendingPayables = payables.filter((p: Record<string, unknown>) => p.status === 'pending');
  const totalReceivable = pendingReceivables.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.amount || 0), 0);
  const totalPayable = pendingPayables.reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount || 0), 0);

  return NextResponse.json({
    agent,
    stats: {
      totalProposals: proposals.length,
      totalClients: clients.length,
      totalBookings: bookings.length,
      statusCounts,
      totalReceivable,
      totalPayable,
    },
    proposals: proposals.slice(0, 20),
    clients: clients.slice(0, 20),
    bookings: bookings.slice(0, 10),
  });
}
