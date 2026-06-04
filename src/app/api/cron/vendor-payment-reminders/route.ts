import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Cron: Vendor Payment Reminders
 * Runs daily. Finds supplier payments due within 48h that aren't paid.
 * Marks overdue payments and logs alerts.
 *
 * Vercel cron: { "path": "/api/cron/vendor-payment-reminders", "schedule": "0 8 * * *" }
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Find items with payment_due_date within 48h or already overdue, not yet paid
  const { data: dueSoon, error: dueErr } = await supabase
    .from('booking_items')
    .select('id, booking_id, label, payment_due_date, vendor_name, portal_name, supplier_status')
    .in('supplier_status', ['confirmed', 'on_hold', 'confirmation_requested'])
    .not('payment_due_date', 'is', null)
    .lte('payment_due_date', in48h);

  if (dueErr) {
    console.error('Vendor payment reminders error:', dueErr);
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  if (!dueSoon || dueSoon.length === 0) {
    return NextResponse.json({ message: 'No vendor payments due soon', count: 0 });
  }

  let reminded = 0;
  let markedOverdue = 0;

  for (const item of dueSoon) {
    const isOverdue = item.payment_due_date < today;

    await supabase.from('booking_logs').insert({
      booking_id: item.booking_id,
      action: isOverdue ? 'vendor_payment_overdue' : 'vendor_payment_due_soon',
      details: {
        item_id: item.id,
        label: item.label,
        vendor: item.vendor_name || item.portal_name || 'Unknown',
        payment_due_date: item.payment_due_date,
      },
    });

    if (isOverdue) {
      markedOverdue++;
    } else {
      reminded++;
    }
  }

  return NextResponse.json({
    message: `Vendor payment reminders: ${reminded} due soon, ${markedOverdue} overdue`,
    reminded,
    markedOverdue,
  });
}
