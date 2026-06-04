import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Cron: Supplier Follow-up
 * Runs daily. Finds items awaiting vendor response for >48h and:
 * 1. Increments followup_count, updates last_followup_at
 * 2. At 3 follow-ups, marks as escalated
 * 3. Logs all actions to booking_logs
 *
 * Vercel cron: { "path": "/api/cron/supplier-followup", "schedule": "0 9 * * *" }
 */
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // Find items that need follow-up:
  // - Status = confirmation_requested
  // - Last follow-up was >48h ago (or never followed up)
  // - Less than 3 follow-ups done
  const { data: items, error } = await supabase
    .from('booking_items')
    .select('id, booking_id, label, followup_count, last_followup_at, vendor_name, portal_name')
    .eq('supplier_status', 'confirmation_requested')
    .lt('followup_count', 3)
    .or(`last_followup_at.is.null,last_followup_at.lt.${fortyEightHoursAgo}`);

  if (error) {
    console.error('Supplier followup cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ message: 'No items need follow-up', count: 0 });
  }

  let followedUp = 0;
  let escalated = 0;

  for (const item of items) {
    const newCount = (item.followup_count || 0) + 1;
    const shouldEscalate = newCount >= 3;

    // Update item
    await supabase
      .from('booking_items')
      .update({
        followup_count: newCount,
        last_followup_at: now.toISOString(),
        ...(shouldEscalate ? { escalated: true, escalated_at: now.toISOString() } : {}),
      })
      .eq('id', item.id);

    // Log the follow-up
    await supabase.from('booking_logs').insert({
      booking_id: item.booking_id,
      action: shouldEscalate ? 'vendor_escalated' : 'vendor_followup',
      details: {
        item_id: item.id,
        label: item.label,
        vendor: item.vendor_name || item.portal_name || 'Unknown',
        followup_number: newCount,
      },
    });

    if (shouldEscalate) {
      escalated++;
    } else {
      followedUp++;
    }
  }

  return NextResponse.json({
    message: `Follow-up complete: ${followedUp} followed up, ${escalated} escalated`,
    followedUp,
    escalated,
  });
}
