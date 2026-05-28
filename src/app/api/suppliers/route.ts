import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { name, type } = await request.json();

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    if (!['hotel', 'flight', 'vehicle'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid supplier type' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Create supplier
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name,
        type,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Supplier creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create supplier' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
