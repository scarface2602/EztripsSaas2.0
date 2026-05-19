import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, AlertTriangle } from 'lucide-react';

export default async function AdminDashboardPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  // All proposals cross-agent
  const { data: proposals } = await supabase.from('proposals').select('*').order('created_at', { ascending: false });
  const allProposals = proposals || [];

  const statusCounts = { draft: 0, sent: 0, viewed: 0, confirmed: 0, cancelled: 0 };
  allProposals.forEach(p => {
    if (p.status in statusCounts) statusCounts[p.status as keyof typeof statusCounts]++;
  });

  // Overdue receivables
  const { data: overdueReceivables } = await supabase
    .from('receivables')
    .select('*, proposals(title, destination)')
    .eq('status', 'overdue')
    .order('due_date');

  // Overdue payables
  const { data: overduePayables } = await supabase
    .from('payables')
    .select('*, suppliers(name)')
    .eq('status', 'overdue')
    .order('due_date');

  // All users for per-agent breakdown
  const { data: users } = await supabase.from('users').select('*');
  const agents = (users || []).filter(u => u.role === 'agent' || u.role === 'super_admin');

  const agentStats = agents.map(agent => {
    const agentProposals = allProposals.filter(p => p.created_by === agent.id);
    const confirmed = agentProposals.filter(p => p.status === 'confirmed');
    return {
      id: agent.id,
      name: agent.full_name,
      email: agent.email,
      totalProposals: agentProposals.length,
      confirmedCount: confirmed.length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {(Object.entries(statusCounts) as [string, number][]).map(([status, count]) => (
          <Card key={status}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground capitalize">{status}</p>
              <p className="text-3xl font-bold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue Receivables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Overdue Receivables
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!overdueReceivables?.length ? (
            <p className="text-sm text-muted-foreground">No overdue receivables</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Proposal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueReceivables.map((r: Record<string, unknown>) => (
                  <TableRow key={r.id as string} className="text-red-600">
                    <TableCell>{r.description as string}</TableCell>
                    <TableCell className="font-bold">{Number(r.amount).toLocaleString()}</TableCell>
                    <TableCell>{r.due_date as string}</TableCell>
                    <TableCell>{(r.proposals as Record<string, unknown>)?.title as string || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Overdue Payables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Overdue Payables
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!overduePayables?.length ? (
            <p className="text-sm text-muted-foreground">No overdue payables</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overduePayables.map((p: Record<string, unknown>) => (
                  <TableRow key={p.id as string} className="text-red-600">
                    <TableCell>{p.description as string}</TableCell>
                    <TableCell className="font-bold">{Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell>{p.due_date as string}</TableCell>
                    <TableCell>{(p.suppliers as Record<string, unknown>)?.name as string || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Per-Agent Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per-Agent Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Total Proposals</TableHead>
                <TableHead>Confirmed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentStats.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>{agent.email}</TableCell>
                  <TableCell>{agent.totalProposals}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-700">{agent.confirmedCount}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
