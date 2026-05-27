import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';
import type { PaymentSchedulePayment } from '@/lib/types/database';

// GET: Fetch all payment schedules for current user
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('payment_schedules')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ schedules: data || [] });
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

// POST: Create a new payment schedule
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, is_template, payments } = body;

    if (!name || !Array.isArray(payments)) {
      return NextResponse.json(
        { error: 'Name and payments array are required' },
        { status: 400 }
      );
    }

    // Validate payments structure
    if (!payments.every((p: PaymentSchedulePayment) => p.amount && p.due_date && p.sequence)) {
      return NextResponse.json(
        { error: 'Each payment must have sequence, amount, and due_date' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('payment_schedules')
      .insert([
        {
          user_id: auth.user.id,
          name,
          is_template: is_template !== false,
          payments,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating payment schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
