import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type ReportType =
  | 'bookings'
  | 'financial'
  | 'agents'
  | 'pending_collections'
  | 'pending_supplier_payments'
  | 'leads';

interface ReportResult {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

const REPORT_ROLES = ['super_admin', 'manager', 'accounts'];

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(result: ReportResult, cols?: string[]): string {
  const columns = cols?.length
    ? result.columns.filter(c => cols.includes(c.key))
    : result.columns;
  const header = columns.map(c => csvEscape(c.label)).join(',');
  const lines = result.rows.map(r => columns.map(c => csvEscape(r[c.key])).join(','));
  return [header, ...lines].join('\n');
}

export async function GET(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: me } = await supabase.from('users').select('id, role').eq('id', authUser.id).single();
  if (!me || !REPORT_ROLES.includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden — reports are for managers, accounts and admins' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const type = (params.get('type') || 'bookings') as ReportType;
  const from = params.get('from') || null;     // ISO date
  const to = params.get('to') || null;         // ISO date
  const agentId = params.get('agent_id') || null;
  const format = params.get('format') || 'json';
  const cols = (params.get('cols') || '').split(',').filter(Boolean);

  // End of the "to" day, so a same-day range still matches.
  const toEnd = to ? `${to}T23:59:59` : null;

  let result: ReportResult;

  switch (type) {
    case 'bookings':
    case 'financial': {
      let q = supabase
        .from('bookings')
        .select('trip_id, title, booking_type, status, destination, travel_start, travel_end, currency, cost_price, sell_price, total_paid, created_at, clients(full_name, phone), users!bookings_created_by_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (from) q = q.gte('created_at', from);
      if (toEnd) q = q.lte('created_at', toEnd);
      if (agentId) q = q.eq('created_by', agentId);
      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      result = {
        columns: [
          { key: 'trip_id', label: 'Trip ID' },
          { key: 'title', label: 'Booking' },
          { key: 'client', label: 'Client' },
          { key: 'agent', label: 'Agent' },
          { key: 'booking_type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'destination', label: 'Destination' },
          { key: 'travel_start', label: 'Travel Start' },
          { key: 'travel_end', label: 'Travel End' },
          { key: 'sell_price', label: 'Sell Price' },
          { key: 'cost_price', label: 'Cost Price' },
          { key: 'margin', label: 'Margin' },
          { key: 'margin_pct', label: 'Margin %' },
          { key: 'total_paid', label: 'Collected' },
          { key: 'balance', label: 'Balance Due' },
          { key: 'created_at', label: 'Created' },
        ],
        rows: (data || []).map(b => {
          const client = b.clients as unknown as { full_name: string } | null;
          const agent = b.users as unknown as { full_name: string } | null;
          const sell = Number(b.sell_price) || 0;
          const cost = Number(b.cost_price) || 0;
          const paid = Number(b.total_paid) || 0;
          return {
            trip_id: b.trip_id,
            title: b.title,
            client: client?.full_name || '',
            agent: agent?.full_name || '',
            booking_type: b.booking_type,
            status: b.status,
            destination: b.destination,
            travel_start: b.travel_start,
            travel_end: b.travel_end,
            sell_price: sell,
            cost_price: cost,
            margin: sell - cost,
            margin_pct: sell > 0 ? Number((((sell - cost) / sell) * 100).toFixed(1)) : 0,
            total_paid: paid,
            balance: sell - paid,
            created_at: (b.created_at || '').slice(0, 10),
          };
        }),
      };
      break;
    }

    case 'agents': {
      const [{ data: users }, { data: enquiries }, { data: proposals }, { data: bookings }] = await Promise.all([
        supabase.from('users').select('id, full_name, role'),
        (() => {
          let q = supabase.from('website_enquiries').select('assigned_to, status, created_at').limit(20000);
          if (from) q = q.gte('created_at', from);
          if (toEnd) q = q.lte('created_at', toEnd);
          return q;
        })(),
        (() => {
          let q = supabase.from('proposals').select('created_by, status, created_at').limit(20000);
          if (from) q = q.gte('created_at', from);
          if (toEnd) q = q.lte('created_at', toEnd);
          return q;
        })(),
        (() => {
          let q = supabase.from('bookings').select('created_by, sell_price, cost_price, created_at').limit(20000);
          if (from) q = q.gte('created_at', from);
          if (toEnd) q = q.lte('created_at', toEnd);
          return q;
        })(),
      ]);

      const rows = (users || [])
        .filter(u => !agentId || u.id === agentId)
        .map(u => {
          const myLeads = (enquiries || []).filter(e => e.assigned_to === u.id);
          const myProposals = (proposals || []).filter(p => p.created_by === u.id);
          const myBookings = (bookings || []).filter(b => b.created_by === u.id);
          const revenue = myBookings.reduce((s, b) => s + (Number(b.sell_price) || 0), 0);
          const cost = myBookings.reduce((s, b) => s + (Number(b.cost_price) || 0), 0);
          const won = myLeads.filter(l => l.status === 'won').length;
          return {
            agent: u.full_name,
            role: u.role,
            leads_assigned: myLeads.length,
            leads_won: won,
            conversion_pct: myLeads.length > 0 ? Number(((won / myLeads.length) * 100).toFixed(1)) : 0,
            proposals_created: myProposals.length,
            proposals_confirmed: myProposals.filter(p => p.status === 'confirmed').length,
            bookings: myBookings.length,
            revenue,
            margin: revenue - cost,
          };
        })
        .filter(r => r.leads_assigned + r.proposals_created + r.bookings > 0 || agentId);

      result = {
        columns: [
          { key: 'agent', label: 'Agent' },
          { key: 'role', label: 'Role' },
          { key: 'leads_assigned', label: 'Leads Assigned' },
          { key: 'leads_won', label: 'Leads Won' },
          { key: 'conversion_pct', label: 'Conversion %' },
          { key: 'proposals_created', label: 'Proposals' },
          { key: 'proposals_confirmed', label: 'Confirmed' },
          { key: 'bookings', label: 'Bookings' },
          { key: 'revenue', label: 'Revenue' },
          { key: 'margin', label: 'Margin' },
        ],
        rows,
      };
      break;
    }

    case 'pending_collections': {
      let q = supabase
        .from('bookings')
        .select('trip_id, title, status, travel_start, currency, sell_price, total_paid, next_payment_date, clients(full_name, phone), users!bookings_created_by_fkey(full_name)')
        .not('status', 'in', '("cancelled")')
        .order('travel_start', { ascending: true })
        .limit(5000);
      if (agentId) q = q.eq('created_by', agentId);
      if (from) q = q.gte('created_at', from);
      if (toEnd) q = q.lte('created_at', toEnd);
      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      result = {
        columns: [
          { key: 'trip_id', label: 'Trip ID' },
          { key: 'title', label: 'Booking' },
          { key: 'client', label: 'Client' },
          { key: 'phone', label: 'Phone' },
          { key: 'agent', label: 'Agent' },
          { key: 'travel_start', label: 'Travel Date' },
          { key: 'sell_price', label: 'Total' },
          { key: 'total_paid', label: 'Collected' },
          { key: 'balance', label: 'Balance Due' },
          { key: 'next_payment_date', label: 'Next Due' },
        ],
        rows: (data || [])
          .map(b => {
            const client = b.clients as unknown as { full_name: string; phone: string } | null;
            const agent = b.users as unknown as { full_name: string } | null;
            const sell = Number(b.sell_price) || 0;
            const paid = Number(b.total_paid) || 0;
            return {
              trip_id: b.trip_id,
              title: b.title,
              client: client?.full_name || '',
              phone: client?.phone || '',
              agent: agent?.full_name || '',
              travel_start: b.travel_start,
              sell_price: sell,
              total_paid: paid,
              balance: sell - paid,
              next_payment_date: b.next_payment_date,
            };
          })
          .filter(r => r.balance > 0),
      };
      break;
    }

    case 'pending_supplier_payments': {
      let q = supabase
        .from('booking_package_payments')
        .select('amount, amount_paid, due_date, status, booking_packages!inner(booking_id, suppliers(name), bookings!inner(trip_id, title, travel_start))')
        .in('status', ['pending', 'due', 'partial_paid', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(5000);
      if (from) q = q.gte('due_date', from);
      if (to) q = q.lte('due_date', to);
      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      result = {
        columns: [
          { key: 'trip_id', label: 'Trip ID' },
          { key: 'booking', label: 'Booking' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'due_date', label: 'Due Date' },
          { key: 'amount', label: 'Amount' },
          { key: 'amount_paid', label: 'Paid' },
          { key: 'outstanding', label: 'Outstanding' },
          { key: 'status', label: 'Status' },
          { key: 'travel_start', label: 'Travel Date' },
        ],
        rows: (data || []).map(p => {
          const pkg = p.booking_packages as unknown as {
            suppliers: { name: string } | null;
            bookings: { trip_id: string | null; title: string; travel_start: string | null };
          };
          const amount = Number(p.amount) || 0;
          const paid = Number(p.amount_paid) || 0;
          return {
            trip_id: pkg?.bookings?.trip_id || '',
            booking: pkg?.bookings?.title || '',
            supplier: pkg?.suppliers?.name || '—',
            due_date: p.due_date,
            amount,
            amount_paid: paid,
            outstanding: amount - paid,
            status: p.status,
            travel_start: pkg?.bookings?.travel_start || '',
          };
        }),
      };
      break;
    }

    case 'leads': {
      let q = supabase
        .from('website_enquiries')
        .select('trip_id, name, phone, destination, requirement_type, status, source, lead_temperature, created_at, first_responded_at, sla_breached_at, converted_at, users:assigned_to(full_name)')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (from) q = q.gte('created_at', from);
      if (toEnd) q = q.lte('created_at', toEnd);
      if (agentId) q = q.eq('assigned_to', agentId);
      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      result = {
        columns: [
          { key: 'trip_id', label: 'Trip ID' },
          { key: 'name', label: 'Client' },
          { key: 'phone', label: 'Phone' },
          { key: 'destination', label: 'Destination' },
          { key: 'requirement_type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'temperature', label: 'Temperature' },
          { key: 'source', label: 'Source' },
          { key: 'agent', label: 'Agent' },
          { key: 'created_at', label: 'Received' },
          { key: 'response_mins', label: 'First Response (min)' },
          { key: 'sla_breached', label: 'SLA Breached' },
          { key: 'converted_at', label: 'Won On' },
        ],
        rows: (data || []).map(e => {
          const agent = (Array.isArray(e.users) ? e.users[0] : e.users) as { full_name: string } | null;
          const responseMins = e.first_responded_at && e.created_at
            ? Math.round((new Date(e.first_responded_at).getTime() - new Date(e.created_at).getTime()) / 60000)
            : null;
          return {
            trip_id: e.trip_id,
            name: e.name,
            phone: e.phone,
            destination: e.destination,
            requirement_type: e.requirement_type,
            status: e.status,
            temperature: e.lead_temperature,
            source: e.source,
            agent: agent?.full_name || 'Unassigned',
            created_at: (e.created_at || '').slice(0, 10),
            response_mins: responseMins,
            sla_breached: e.sla_breached_at ? 'Yes' : '',
            converted_at: e.converted_at ? e.converted_at.slice(0, 10) : '',
          };
        }),
      };
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  }

  if (format === 'csv') {
    const filename = `eztrips-${type}-${from || 'all'}-to-${to || 'now'}.csv`;
    return new NextResponse(toCsv(result, cols), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json(result);
}
