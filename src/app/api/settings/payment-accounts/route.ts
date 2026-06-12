import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch all payment accounts for current user
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    // ?scope=org — accounts of everyone in the org (the receipts flow
    // needs the org's bank/UPI/cash accounts, not just the caller's).
    let userIds: string[] = [auth.user.id];
    if (request.nextUrl.searchParams.get('scope') === 'org' && auth.user.org_id) {
      const { data: orgUsers } = await supabase.from('users').select('id').eq('org_id', auth.user.org_id);
      if (orgUsers && orgUsers.length > 0) userIds = orgUsers.map((u: { id: string }) => u.id);
    }

    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .in('user_id', userIds)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ accounts: data || [] });
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST: Create a new payment account
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { account_name, account_number, account_type, bank_name, notes, is_active } = body;

    if (!account_name || !account_type) {
      return NextResponse.json(
        { error: 'Account name and type are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get the next sort_order
    const { data: existing } = await supabase
      .from('payment_accounts')
      .select('sort_order')
      .eq('user_id', auth.user.id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSort = ((existing?.[0]?.sort_order || -1) + 1);

    const { data, error } = await supabase
      .from('payment_accounts')
      .insert([
        {
          user_id: auth.user.id,
          account_name,
          account_number,
          account_type,
          bank_name: bank_name || null,
          notes: notes || null,
          is_active: is_active !== false,
          sort_order: nextSort,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating payment account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
