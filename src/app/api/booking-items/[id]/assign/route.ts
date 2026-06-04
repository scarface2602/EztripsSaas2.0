import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: itemId } = await params;
  const { assigned_to } = await req.json();

  const supabase = createServiceClient();

  // Verify item exists
  const { data: item } = await supabase
    .from('booking_items')
    .select('id, booking_id, label')
    .eq('id', itemId)
    .single();

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // Update assignment
  const { error } = await supabase
    .from('booking_items')
    .update({ assigned_to: assigned_to || null })
    .eq('id', itemId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get assignee name for log
  let assigneeName = 'Unassigned';
  if (assigned_to) {
    const { data: assignee } = await supabase.from('users').select('full_name').eq('id', assigned_to).single();
    assigneeName = assignee?.full_name || 'Unknown';
  }

  // Log activity
  await supabase.from('booking_logs').insert({
    booking_id: item.booking_id,
    user_id: auth.authUser.id,
    action: 'ops_assigned',
    details: {
      item_id: itemId,
      label: item.label,
      assigned_to,
      assigned_to_name: assigneeName,
    },
  });

  return NextResponse.json({ success: true, assigned_to, assigned_to_name: assigneeName });
}
