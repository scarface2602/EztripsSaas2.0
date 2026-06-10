import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendConfirmationToAgent } from '@/lib/email/mailer';
import { createBookingsFromProposal } from '@/lib/bookings';

interface ConfirmBody {
  choices?: Record<string, 'pvt' | 'sic'>; // activity_id -> choice
  tier_id?: string;
  addon_ids?: string[];
  confirmed_by?: 'client' | 'agent';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Get proposal — id may be a UUID (agent flow) or a share_token (client flow)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: proposal, error: proposalErr } = await supabase
    .from('proposals')
    .select('*')
    .eq(isUUID ? 'id' : 'share_token', id)
    .single();

  if (proposalErr || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (proposal.status === 'confirmed') {
    return NextResponse.json({ error: 'Already confirmed' }, { status: 400 });
  }

  const body: ConfirmBody = await request.json();
  const confirmedBy = body.confirmed_by || 'client';
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Use the resolved proposal UUID for all subsequent queries
  const proposalId = proposal.id;

  // Validate dual-option choices
  const { data: dualActivities } = await supabase
    .from('itinerary_activities')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('option_mode', 'dual');

  if (dualActivities && dualActivities.length > 0) {
    const choices = body.choices || {};
    const missingChoices = dualActivities.filter(a => !choices[a.id]);
    if (missingChoices.length > 0) {
      return NextResponse.json(
        { error: 'All dual pvt/SIC items must have a selection', missing: missingChoices.map(a => a.id) },
        { status: 400 }
      );
    }

    // Write confirmed_cp/sp for each dual activity
    for (const activity of dualActivities) {
      const choice = choices[activity.id];
      const { data: act } = await supabase
        .from('itinerary_activities')
        .select('*')
        .eq('id', activity.id)
        .single();

      if (act) {
        const confirmedCp = choice === 'pvt' ? act.pvt_cp : act.sic_cp;
        const confirmedSp = choice === 'pvt' ? act.pvt_sp : act.sic_sp;
        const confirmedBasis = choice === 'pvt' ? act.pvt_basis : act.sic_basis;

        await supabase
          .from('itinerary_activities')
          .update({
            client_choice: choice,
            confirmed_cp: confirmedCp,
            confirmed_sp: confirmedSp,
            confirmed_basis: confirmedBasis,
          })
          .eq('id', activity.id);
      }
    }
  }

  // Set confirmed status on proposal
  const now = new Date().toISOString();
  await supabase
    .from('proposals')
    .update({
      status: 'confirmed',
      confirmed_at: now,
      confirmed_by: confirmedBy,
    })
    .eq('id', proposalId);

  // If proposal was created from an enquiry, mark it as 'won'
  if (proposal.enquiry_id) {
    await supabase
      .from('website_enquiries')
      .update({ status: 'won', converted_at: now, updated_at: now })
      .eq('id', proposal.enquiry_id);
  }

  // Calculate grand total from SP values (for acceptance log + email)
  const [
    { data: hotels },
    { data: flights },
    { data: activities },
    { data: lineItems },
  ] = await Promise.all([
    supabase.from('hotels').select('sp_per_night, nights').eq('proposal_id', proposalId),
    supabase.from('flights').select('sp_total').eq('proposal_id', proposalId),
    supabase.from('itinerary_activities').select('confirmed_sp, pvt_sp, sic_sp, is_optional, option_mode').eq('proposal_id', proposalId),
    supabase.from('line_items').select('sp, is_optional, is_included').eq('proposal_id', proposalId),
  ]);

  let subtotal = 0;
  (hotels || []).forEach((h) => { subtotal += (Number(h.sp_per_night) || 0) * (Number(h.nights) || 0); });
  (flights || []).forEach((f) => { subtotal += Number(f.sp_total) || 0; });
  (activities || []).forEach((a) => {
    if (a.is_optional) return;
    if (a.option_mode === 'dual') {
      subtotal += Number(a.confirmed_sp) || 0;
    } else {
      subtotal += Number(a.pvt_sp) || Number(a.sic_sp) || 0;
    }
  });
  (lineItems || []).forEach((li) => {
    if (li.is_included && !li.is_optional) subtotal += Number(li.sp) || 0;
  });

  // Apply discount, GST, TCS, rounding
  const discount = Number(proposal.discount_amount) || 0;
  const afterDiscount = subtotal - discount;
  const gst = proposal.gst_enabled ? afterDiscount * (Number(proposal.gst_rate) || 5) / 100 : 0;
  const tcs = proposal.tcs_enabled ? afterDiscount * 0.05 : 0;
  let grandTotal = afterDiscount + gst + tcs;
  const roundingUnit = Number(proposal.rounding_unit) || 0;
  if (roundingUnit > 0) grandTotal = Math.ceil(grandTotal / roundingUnit) * roundingUnit;

  // Call unified booking creation engine
  const { createdBookings, createdPackages } = await createBookingsFromProposal(supabase, proposal, proposal.created_by || '');

  // --- Attach Unified Client Payment Schedule (AR) ---
  // The client pays a single consolidated deposit & balance for the entire trip.
  // We attach these installments to the first generated booking_package.
  if (createdPackages.length > 0) {
    const paymentTerms = proposal.payment_terms as { deposit_pct?: number; balance_days_before?: number } | null;
    const depositPct = paymentTerms?.deposit_pct ?? 30;
    const balanceDaysBefore = paymentTerms?.balance_days_before ?? 30;

    const depositAmount = Math.round(grandTotal * depositPct / 100);
    const balanceAmount = grandTotal - depositAmount;

    const travelStart = proposal.travel_start ? new Date(proposal.travel_start) : new Date();
    const balanceDueDate = new Date(travelStart);
    balanceDueDate.setDate(balanceDueDate.getDate() - balanceDaysBefore);

    const firstPackageId = (createdPackages[0] as { id: string }).id;
    const payments = [
      {
        package_id: firstPackageId,
        sequence: 1,
        amount: depositAmount,
        due_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      },
    ];

    if (balanceAmount > 0) {
      payments.push({
        package_id: firstPackageId,
        sequence: 2,
        amount: balanceAmount,
        due_date: balanceDueDate.toISOString().split('T')[0],
        status: 'pending',
      });
    }

    await supabase.from('booking_package_payments').insert(payments);
  }

  // Copy passenger details from proposal to booking_passenger_details
  const passengerDetails = proposal.passenger_details as Array<Record<string, unknown>> | null;
  if (passengerDetails && passengerDetails.length > 0 && createdBookings.length > 0) {
    for (const booking of createdBookings) {
      const records = passengerDetails.map((p, i) => ({
        booking_id: booking.id as string,
        pax_index: i,
        first_name: (p.firstName as string) || '',
        last_name: (p.lastName as string) || '',
        gender: (p.gender as string) || null,
        date_of_birth: (p.dateOfBirth as string) || null,
        passport_urls: (p.passportFiles as string[]) || null,
        pan_urls: (p.panFiles as string[]) || null,
        is_child: (p.isChild as boolean) || false,
      }));
      await supabase.from('booking_passenger_details').insert(records);
      await supabase.from('bookings').update({
        passenger_details_completed: true,
        passenger_details_completed_at: now,
      }).eq('id', booking.id as string);
    }
  }

  // Log to proposal_acceptance_log
  await supabase.from('proposal_acceptance_log').insert({
    proposal_id: proposalId,
    version: proposal.version || 1,
    event_type: 'confirmed',
    ip_address: ip,
    user_agent: userAgent,
    metadata: {
      confirmed_by: confirmedBy,
      choices: body.choices || null,
      tier_id: body.tier_id || null,
      addon_ids: body.addon_ids || null,
      grand_total: grandTotal,
    },
  });

  // Send confirmation email to agent (fire-and-forget)
  try {
    const [{ data: agentUser }, { data: clientData }] = await Promise.all([
      proposal.created_by
        ? supabase.from('users').select('full_name, email').eq('id', proposal.created_by).single()
        : Promise.resolve({ data: null }),
      proposal.client_id
        ? supabase.from('clients').select('full_name').eq('id', proposal.client_id).single()
        : Promise.resolve({ data: null }),
    ]);
    if (agentUser?.email) {
      await sendConfirmationToAgent({
        to: agentUser.email,
        agentName: agentUser.full_name || 'Agent',
        clientName: clientData?.full_name || 'Client',
        proposalTitle: proposal.title || 'Travel Proposal',
        destination: proposal.destination || '',
        grandTotal,
        currency: proposal.currency || 'INR',
        proposalId,
      });
    }
  } catch {
    // Email failure should not block the confirm response
  }

  return NextResponse.json({
    success: true,
    proposal_id: proposalId,
    grand_total: grandTotal,
    bookings_count: createdBookings.length,
    packages_count: createdPackages.length,
  });
}
