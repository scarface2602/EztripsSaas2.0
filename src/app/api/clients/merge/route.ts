import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

const mergeSchema = z.object({
  source_id: z.string().uuid(), // duplicate being absorbed
  target_id: z.string().uuid(), // surviving client
});

// Every table that references clients(id). Kept explicit so a new FK
// added elsewhere forces a conscious decision here.
const CLIENT_REFS: Array<{ table: string; column: string }> = [
  { table: 'bookings', column: 'client_id' },
  { table: 'bookings', column: 'bill_to_client_id' },
  { table: 'booking_payments', column: 'client_id' },
  { table: 'proposals', column: 'client_id' },
  { table: 'trips', column: 'client_id' },
  { table: 'website_enquiries', column: 'client_id' },
  { table: 'client_ledger', column: 'client_id' },
  { table: 'invoices', column: 'client_id' },
  { table: 'discount_code_usage', column: 'client_id' },
  { table: 'clients', column: 'contact_client_id' },
];

// POST /api/clients/merge — absorb a duplicate client into another.
// All references move to the target, then the duplicate is deleted.
// Destructive and cross-cutting, so super_admin only.
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only a super admin can merge clients' }, { status: 403 });
    }

    const { source_id, target_id } = mergeSchema.parse(await request.json());
    if (source_id === target_id) {
      return NextResponse.json({ error: 'Source and target are the same client' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const [{ data: source }, { data: target }] = await Promise.all([
      supabase.from('clients').select('id, full_name, phone, email, notes').eq('id', source_id).single(),
      supabase.from('clients').select('id, full_name, notes').eq('id', target_id).single(),
    ]);
    if (!source || !target) {
      return NextResponse.json({ error: 'Source or target client not found' }, { status: 404 });
    }

    const moved: Record<string, number> = {};
    for (const { table, column } of CLIENT_REFS) {
      const { data, error } = await supabase
        .from(table)
        .update({ [column]: target_id })
        .eq(column, source_id)
        .select('id');
      if (error) {
        // 42P01 = table missing in this environment — skip, don't abort the merge
        if (error.code === '42P01') continue;
        return NextResponse.json(
          { error: `Failed moving ${table}.${column}: ${error.message}`, moved },
          { status: 500 },
        );
      }
      if (data && data.length > 0) moved[`${table}.${column}`] = data.length;
    }

    // Preserve the duplicate's identity in the survivor's notes for audit
    const mergeNote = `[merged] absorbed "${source.full_name}"${source.phone ? ` (${source.phone})` : ''} on ${new Date().toISOString().slice(0, 10)}`;
    await supabase
      .from('clients')
      .update({ notes: target.notes ? `${target.notes}\n${mergeNote}` : mergeNote })
      .eq('id', target_id);

    const { error: delError } = await supabase.from('clients').delete().eq('id', source_id);
    if (delError) {
      return NextResponse.json(
        { error: `References moved but could not delete duplicate: ${delError.message}`, moved },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, moved });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Client merge error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
