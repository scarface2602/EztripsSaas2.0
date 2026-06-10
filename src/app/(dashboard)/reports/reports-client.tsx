'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Download, Loader2, ClipboardList, IndianRupee, Users, Clock, Truck, Inbox } from 'lucide-react';
import { format, subDays } from 'date-fns';

const REPORT_TYPES = [
  { value: 'bookings', label: 'Bookings Report', icon: ClipboardList, description: 'All bookings with revenue, cost, margin and collection status' },
  { value: 'financial', label: 'Financial Report', icon: IndianRupee, description: 'Revenue, cost, margin and outstanding balances per booking' },
  { value: 'agents', label: 'Agent Performance', icon: Users, description: 'Leads, conversion, proposals, bookings and revenue per agent' },
  { value: 'pending_collections', label: 'Pending Collections', icon: Clock, description: 'Client balances still to be collected, by travel date' },
  { value: 'pending_supplier_payments', label: 'Supplier Dues', icon: Truck, description: 'Outstanding supplier installments, by due date' },
  { value: 'leads', label: 'Leads Report', icon: Inbox, description: 'Every enquiry with response time, SLA and conversion' },
] as const;

interface ReportColumn { key: string; label: string }
interface ReportData { columns: ReportColumn[]; rows: Record<string, unknown>[] }

const NUMERIC_HINTS = ['price', 'margin', 'paid', 'balance', 'revenue', 'amount', 'outstanding'];

export default function ReportsClient({ agents }: { agents: { id: string; full_name: string; role: string }[] }) {
  const [type, setType] = useState<string>('bookings');
  const [from, setFrom] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [agentId, setAgentId] = useState<string>('all');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [excludedCols, setExcludedCols] = useState<Set<string>>(new Set());

  const queryString = useCallback((fmt?: string) => {
    const params = new URLSearchParams({ type, from, to });
    if (agentId !== 'all') params.set('agent_id', agentId);
    if (fmt) params.set('format', fmt);
    if (fmt === 'csv' && data) {
      const included = data.columns.filter(c => !excludedCols.has(c.key)).map(c => c.key);
      if (included.length < data.columns.length) params.set('cols', included.join(','));
    }
    return params.toString();
  }, [type, from, to, agentId, data, excludedCols]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports?${queryString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setData(json);
      setExcludedCols(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, from, to, agentId]);

  useEffect(() => { load(); }, [load]);

  function toggleColumn(key: string) {
    setExcludedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleColumns = useMemo(
    () => (data?.columns || []).filter(c => !excludedCols.has(c.key)),
    [data, excludedCols],
  );

  // Totals row for numeric columns
  const totals = useMemo(() => {
    if (!data) return {};
    const t: Record<string, number> = {};
    for (const col of data.columns) {
      if (!NUMERIC_HINTS.some(h => col.key.includes(h))) continue;
      if (col.key.includes('pct')) continue;
      t[col.key] = data.rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
    }
    return t;
  }, [data]);

  const activeMeta = REPORT_TYPES.find(r => r.value === type);

  return (
    <div className="space-y-4">
      {/* Report type cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const active = type === rt.value;
          return (
            <button
              key={rt.value}
              onClick={() => setType(rt.value)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
              }`}
            >
              <Icon className={`h-4 w-4 mb-1.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium leading-tight">{rt.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs mb-1 block">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="w-52">
              <Label className="text-xs mb-1 block">Agent</Label>
              <Select value={agentId} onValueChange={v => setAgentId(v || 'all')}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <a href={`/api/reports?${queryString('csv')}`} download>
              <Button className="gap-2" disabled={loading || !data || data.rows.length === 0}>
                <Download className="h-4 w-4" /> Download CSV
              </Button>
            </a>
          </div>
          {activeMeta && <p className="text-xs text-muted-foreground mt-3">{activeMeta.description}</p>}
        </CardContent>
      </Card>

      {/* Column picker — customise what goes into the download */}
      {data && data.columns.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Columns:</span>
          {data.columns.map(col => {
            const excluded = excludedCols.has(col.key);
            return (
              <button key={col.key} onClick={() => toggleColumn(col.key)}>
                <Badge
                  variant={excluded ? 'outline' : 'secondary'}
                  className={`cursor-pointer text-xs ${excluded ? 'opacity-50 line-through' : ''}`}
                >
                  {col.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-center text-red-600 py-12 text-sm">{error}</p>
          ) : !data || data.rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No data for this period</p>
          ) : (
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {visibleColumns.map(c => (
                      <TableHead key={c.key} className="whitespace-nowrap text-xs">{c.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row, i) => (
                    <TableRow key={i}>
                      {visibleColumns.map(c => {
                        const v = row[c.key];
                        const isNum = typeof v === 'number';
                        return (
                          <TableCell key={c.key} className={`whitespace-nowrap text-sm ${isNum ? 'text-right tabular-nums' : ''}`}>
                            {v == null || v === '' ? '—' : isNum ? Number(v).toLocaleString('en-IN') : String(v)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
                {Object.keys(totals).length > 0 && (
                  <tfoot className="sticky bottom-0 bg-muted/95 border-t font-semibold">
                    <tr>
                      {visibleColumns.map((c, idx) => (
                        <td key={c.key} className="px-4 py-2 text-sm text-right tabular-nums whitespace-nowrap">
                          {idx === 0 && !(c.key in totals)
                            ? `${data.rows.length} rows`
                            : c.key in totals
                              ? Number(totals[c.key]).toLocaleString('en-IN')
                              : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
