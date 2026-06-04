import { createServiceClient, createClient } from '@/lib/supabase/server';
import OperationsClient from './operations-client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function OperationsPage() {
  const supabase = createServiceClient();
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  const currentUserId = authUser?.id || '';
  const today = new Date().toISOString().split('T')[0];

  // Fetch all active booking items needing attention
  const { data: activeItems } = await supabase
    .from('booking_items')
    .select(`
      id, item_type, label, supplier_status, supplier_reference,
      vendor_name, vendor_email, portal_name, payment_due_date,
      start_date, end_date, cost_price,
      followup_count, last_followup_at, escalated,
      booking_id, assigned_to, checked_in_at, checked_out_at,
      bookings!inner (
        id, title, destination, travel_start, status,
        clients ( full_name )
      )
    `)
    .in('supplier_status', ['pending', 'confirmation_requested', 'on_hold', 'confirmed'])
    .order('start_date', { ascending: true });

  // Today's travel (check-ins: start_date = today)
  const { data: todayTravel } = await supabase
    .from('booking_items')
    .select(`
      id, item_type, label, supplier_status, supplier_reference,
      vendor_name, vendor_email, portal_name,
      start_date, end_date, booking_id, followup_count, last_followup_at, escalated, payment_due_date,
      assigned_to, checked_in_at, checked_out_at,
      bookings!inner ( id, title, clients ( full_name ) )
    `)
    .eq('start_date', today);

  // Today's check-outs (end_date = today)
  const { data: todayCheckouts } = await supabase
    .from('booking_items')
    .select(`
      id, item_type, label, supplier_status, supplier_reference,
      vendor_name, vendor_email, portal_name,
      start_date, end_date, booking_id, followup_count, last_followup_at, escalated, payment_due_date,
      assigned_to, checked_in_at, checked_out_at,
      bookings!inner ( id, title, clients ( full_name ) )
    `)
    .eq('end_date', today)
    .not('checked_in_at', 'is', null);

  // Fetch team members for ops assignment
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name, role')
    .in('role', ['super_admin', 'agent', 'manager', 'operations'])
    .order('full_name');

  // Supplier dues this week (from booking_payments)
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: supplierDues } = await supabase
    .from('booking_payments')
    .select('amount, supplier_id')
    .eq('direction', 'payable')
    .in('status', ['pending', 'partial'])
    .gte('due_date', today)
    .lte('due_date', weekEnd);

  const supplierDueTotal = (supplierDues || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const supplierDueCount = new Set((supplierDues || []).map((p: any) => p.supplier_id).filter(Boolean)).size;

  return (
    <OperationsClient
      items={(activeItems || []) as any[]}
      todayItems={(todayTravel || []) as any[]}
      todayCheckouts={(todayCheckouts || []) as any[]}
      teamMembers={(teamMembers || []) as any[]}
      currentUserId={currentUserId}
      supplierDues={{ total: supplierDueTotal, supplierCount: supplierDueCount }}
    />
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
