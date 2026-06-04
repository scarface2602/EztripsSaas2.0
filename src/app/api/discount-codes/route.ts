import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

// GET: List all discount codes (admin) or validate a code (public via ?code=X&client_email=Y)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  // Public: validate a specific code
  if (code) {
    const supabase = createServiceClient();
    const clientEmail = req.nextUrl.searchParams.get('client_email') || '';
    const clientId = req.nextUrl.searchParams.get('client_id') || '';

    const { data, error } = await supabase
      .from('discount_codes')
      .select('id, code, discount_type, discount_value, usage_mode, max_uses, max_uses_per_customer, used_count, valid_from, valid_to, is_active')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid discount code' }, { status: 404 });
    }

    const now = new Date().toISOString().split('T')[0];
    if (data.valid_from && now < data.valid_from) {
      return NextResponse.json({ error: 'Discount code is not yet active' }, { status: 400 });
    }
    if (data.valid_to && now > data.valid_to) {
      return NextResponse.json({ error: 'Discount code has expired' }, { status: 400 });
    }

    // Check global usage limit
    if (data.max_uses && data.used_count >= data.max_uses) {
      return NextResponse.json({ error: 'Discount code usage limit reached' }, { status: 400 });
    }

    // Check usage mode
    if (data.usage_mode === 'single' && data.used_count >= 1) {
      return NextResponse.json({ error: 'This code has already been used' }, { status: 400 });
    }

    if ((data.usage_mode === 'per_customer' || data.usage_mode === 'n_per_customer') && (clientEmail || clientId)) {
      // Check per-customer usage
      let query = supabase
        .from('discount_code_usage')
        .select('id', { count: 'exact', head: true })
        .eq('discount_code_id', data.id);

      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (clientEmail) {
        query = query.eq('client_email', clientEmail);
      }

      const { count } = await query;
      const customerUseCount = count || 0;

      if (data.usage_mode === 'per_customer' && customerUseCount >= 1) {
        return NextResponse.json({ error: 'You have already used this discount code' }, { status: 400 });
      }
      if (data.usage_mode === 'n_per_customer' && data.max_uses_per_customer && customerUseCount >= data.max_uses_per_customer) {
        return NextResponse.json({ error: `You have reached the maximum uses (${data.max_uses_per_customer}) for this code` }, { status: 400 });
      }
    }

    return NextResponse.json({
      id: data.id,
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
    });
  }

  // Admin: list all codes
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: Create a new discount code
export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { code, discount_type, discount_value, usage_mode, max_uses, max_uses_per_customer, valid_from, valid_to } = body;

  if (!code || !discount_type || !discount_value) {
    return NextResponse.json({ error: 'code, discount_type, and discount_value are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      created_by: user.id,
      code: code.toUpperCase(),
      discount_type,
      discount_value: Number(discount_value),
      usage_mode: usage_mode || 'unlimited',
      max_uses: max_uses ? Number(max_uses) : null,
      max_uses_per_customer: max_uses_per_customer ? Number(max_uses_per_customer) : null,
      valid_from: valid_from || null,
      valid_to: valid_to || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH: Update a discount code or record usage
export async function PATCH(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { id, record_usage, client_id, client_email, proposal_id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Record usage: increment count + log per-customer usage
  if (record_usage) {
    const { data: current } = await supabase
      .from('discount_codes')
      .select('used_count')
      .eq('id', id)
      .single();

    await supabase
      .from('discount_codes')
      .update({ used_count: (current?.used_count || 0) + 1 })
      .eq('id', id);

    await supabase.from('discount_code_usage').insert({
      discount_code_id: id,
      client_id: client_id || null,
      client_email: client_email || null,
      proposal_id: proposal_id || null,
    });

    return NextResponse.json({ success: true });
  }

  const { data, error } = await supabase
    .from('discount_codes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
