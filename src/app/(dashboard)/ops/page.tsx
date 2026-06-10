'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OpsTask, OpsTaskStatus } from '@/lib/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarDays, Truck, CheckCircle2 } from 'lucide-react';

const COLUMNS: { key: OpsTaskStatus; label: string; color: string }[] = [
  { key: 'to_book', label: 'To Book', color: 'bg-blue-50 border-blue-200' },
  { key: 'pending_dmc', label: 'Pending DMC', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'payment_requested', label: 'Payment Requested', color: 'bg-orange-50 border-orange-200' },
  { key: 'ready_for_vouchers', label: 'Ready for Vouchers', color: 'bg-green-50 border-green-200' },
];

interface GroupedTasks {
  trip_id: string;
  travel_date: string | null;
  tasks: OpsTask[];
}

function groupByTrip(tasks: OpsTask[]): GroupedTasks[] {
  const map = new Map<string, GroupedTasks>();
  for (const t of tasks) {
    const existing = map.get(t.trip_id);
    if (existing) {
      existing.tasks.push(t);
    } else {
      map.set(t.trip_id, { trip_id: t.trip_id, travel_date: t.travel_date, tasks: [t] });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (!a.travel_date) return 1;
    if (!b.travel_date) return -1;
    return a.travel_date.localeCompare(b.travel_date);
  });
}

function TripCard({ group }: { group: GroupedTasks }) {
  return (
    <Card className="mb-3 shadow-sm">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold font-mono text-primary">{group.trip_id}</CardTitle>
          {group.travel_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {new Date(group.travel_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {group.tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{task.description}</p>
              {task.supplier_name && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" /> {task.supplier_name}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function OpsCommandCenter() {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Load ops tasks from booking_items with supplier info, mapped to OpsTask shape
      const { data: items } = await supabase
        .from('booking_items')
        .select(`
          id, booking_id, item_type, label, supplier_status, supplier_id,
          assigned_to, created_at, updated_at,
          bookings!inner(trip_id, travel_start),
          suppliers(name)
        `)
        .order('created_at', { ascending: false });

      if (items) {
        const mapped: OpsTask[] = items.map((item: Record<string, unknown>) => {
          const booking = item.bookings as Record<string, unknown> | null;
          const supplier = item.suppliers as Record<string, unknown> | null;

          // Map supplier_status to OpsTaskStatus
          let status: OpsTaskStatus = 'to_book';
          const ss = item.supplier_status as string;
          if (ss === 'pending' || ss === 'not_started') status = 'to_book';
          else if (ss === 'requested' || ss === 'confirmation_requested' || ss === 'follow_up') status = 'pending_dmc';
          else if (ss === 'on_hold') status = 'payment_requested';
          else if (ss === 'confirmed') status = 'ready_for_vouchers';

          return {
            id: item.id as string,
            trip_id: (booking?.trip_id as string) || `BK-${(item.booking_id as string).slice(0, 8)}`,
            booking_item_id: item.id as string,
            supplier_id: item.supplier_id as string | null,
            supplier_name: (supplier?.name as string) || null,
            description: (item.label as string) || (item.item_type as string) || 'Untitled',
            status,
            travel_date: (booking?.travel_start as string) || null,
            assigned_to: item.assigned_to as string | null,
            notes: null,
            created_at: item.created_at as string,
            updated_at: item.updated_at as string,
          };
        });
        setTasks(mapped);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const tasksByStatus = useMemo(() => {
    const map: Record<OpsTaskStatus, OpsTask[]> = {
      to_book: [],
      pending_dmc: [],
      payment_requested: [],
      ready_for_vouchers: [],
    };
    for (const t of tasks) {
      map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ops Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} across all trips
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col.key];
          const groups = groupByTrip(colTasks);
          return (
            <div key={col.key} className={`rounded-xl border p-4 ${col.color} min-h-[300px]`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
              </div>
              <div className="space-y-0">
                {groups.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                )}
                {groups.map((g) => (
                  <TripCard key={g.trip_id} group={g} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
