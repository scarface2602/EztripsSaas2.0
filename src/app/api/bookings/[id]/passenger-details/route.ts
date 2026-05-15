import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const passengerDetailsSchema = z.object({
    passengers: z.array(z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        gender: z.enum(['male', 'female', 'other']),
        dateOfBirth: z.string().optional(),
        passportFiles: z.array(z.string()).optional(),
        panFiles: z.array(z.string()).optional(),
        isChild: z.boolean(),
    })),
    skipDocuments: z.boolean().optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const validated = passengerDetailsSchema.parse(body);
        const supabase = createServiceClient();

        const passengerRecords = validated.passengers.map((p, index) => ({
            booking_id: params.id,
            pax_index: index,
            pax_count: validated.passengers.length,
            first_name: p.firstName,
            last_name: p.lastName,
            gender: p.gender,
            date_of_birth: p.dateOfBirth || null,
            passport_urls: p.passportFiles || null,
            pan_urls: p.panFiles || null,
        }));

        const { error: insertError } = await supabase
            .from('booking_passenger_details')
            .insert(passengerRecords);

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                passenger_details_completed: true,
                passenger_details_completed_at: new Date().toISOString(),
            })
            .eq('id', params.id);

        if (updateError) throw updateError;

        await supabase.from('booking_logs').insert({
            booking_id: params.id,
            action: 'passenger_details_submitted',
            details: { passenger_count: validated.passengers.length },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Error saving passenger details:', err);
        return NextResponse.json({ error: 'Failed to save passenger details' }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServiceClient();

        const { data, error } = await supabase
            .from('booking_passenger_details')
            .select('*')
            .eq('booking_id', params.id);

        if (error) throw error;

        return NextResponse.json(data);
    } catch (err) {
        console.error('Error fetching passenger details:', err);
        return NextResponse.json({ error: 'Failed to fetch passenger details' }, { status: 500 });
    }
}
