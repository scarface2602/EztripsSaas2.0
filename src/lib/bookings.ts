import { createServiceClient } from '@/lib/supabase/server';

export async function createBookingsFromProposal(
  supabase: ReturnType<typeof createServiceClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proposal: Record<string, any>,
  userId: string,
) {
  const proposalId = proposal.id;
  const common = {
    proposal_id: proposalId,
    client_id: proposal.client_id,
    created_by: userId,
    destination: proposal.destination,
    travel_start: proposal.travel_start,
    travel_end: proposal.travel_end,
    pax_adults: proposal.pax_adults || 1,
    pax_children: proposal.pax_children || 0,
    currency: proposal.currency || 'INR',
    status: 'confirmed' as const,
  };

  const travelStart = proposal.travel_start ? new Date(proposal.travel_start) : new Date();
  const createdBookings: Record<string, unknown>[] = [];

  if (proposal.quote_type === 'package') {
    const { data: hotels } = await supabase
      .from('hotels')
      .select('supplier_id')
      .eq('proposal_id', proposalId)
      .limit(1);

    const supplierId = hotels?.[0]?.supplier_id || null;

    const [
      { data: hotelsAll },
      { data: flights },
      { data: activities },
      { data: lineItems },
    ] = await Promise.all([
      supabase.from('hotels').select('cp_per_night, nights').eq('proposal_id', proposalId),
      supabase.from('flights').select('cp_total').eq('proposal_id', proposalId),
      supabase.from('itinerary_activities').select('confirmed_cp, pvt_cp, sic_cp, is_optional, option_mode').eq('proposal_id', proposalId),
      supabase.from('line_items').select('cp, is_optional, is_included').eq('proposal_id', proposalId),
    ]);

    let totalCost = 0;
    (hotelsAll || []).forEach(h => { totalCost += (Number(h.cp_per_night) || 0) * (Number(h.nights) || 0); });
    (flights || []).forEach(f => { totalCost += Number(f.cp_total) || 0; });
    (activities || []).forEach(a => {
      if (a.is_optional) return;
      if (a.option_mode === 'dual') totalCost += Number(a.confirmed_cp) || 0;
      else totalCost += Number(a.pvt_cp) || Number(a.sic_cp) || 0;
    });
    (lineItems || []).forEach(li => {
      if (li.is_included && !li.is_optional) totalCost += Number(li.cp) || 0;
    });

    const { data: booking } = await supabase.from('bookings').insert({
      ...common,
      supplier_id: supplierId,
      booking_type: 'package',
      title: proposal.title || 'Package Booking',
      cost_price: Math.round(totalCost * 100) / 100,
      sell_price: Number(proposal.total_sp) || 0,
    }).select().single();

    if (booking) {
      createdBookings.push(booking);
      await createDefaultInstallments(supabase, booking.id, booking.cost_price, travelStart);
      await logBookingCreated(supabase, booking.id, userId, proposalId, 'package');
    }
  } else {
    // Itemised: multiple bookings

    // --- Hotels: one booking per hotel ---
    const { data: hotels } = await supabase
      .from('hotels')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order');

    for (const h of (hotels || [])) {
      const nights = Number(h.nights) || Math.max(1, Math.round(
        (new Date(h.check_out).getTime() - new Date(h.check_in).getTime()) / 86400000
      ));
      const cost = (Number(h.cp_per_night) || 0) * nights;
      const sell = (Number(h.sp_per_night) || 0) * nights;

      const { data: booking } = await supabase.from('bookings').insert({
        ...common,
        supplier_id: h.supplier_id,
        booking_type: 'hotel',
        title: `${h.name} – ${h.city}`,
        travel_start: h.check_in,
        travel_end: h.check_out,
        cost_price: Math.round(cost * 100) / 100,
        sell_price: Math.round(sell * 100) / 100,
        status: 'pending',
      }).select().single();

      if (booking) {
        createdBookings.push(booking);
        await createDefaultInstallments(supabase, booking.id, booking.cost_price, new Date(h.check_in));
        await logBookingCreated(supabase, booking.id, userId, proposalId, 'hotel');
      }
    }

    // --- Land services: group by supplier ---
    const [
      { data: activitiesAll },
      { data: lineItemsAll },
    ] = await Promise.all([
      supabase.from('itinerary_activities').select('supplier_id, confirmed_cp, confirmed_sp, pvt_cp, pvt_sp, sic_cp, sic_sp, is_optional, option_mode, type, location').eq('proposal_id', proposalId),
      supabase.from('line_items').select('supplier_id, cp, sp, is_optional, is_included, description, type').eq('proposal_id', proposalId),
    ]);

    const landBySupplier: Record<string, { cost: number; sell: number; items: string[] }> = {};
    const addLand = (suppId: string | null, cost: number, sell: number, desc: string) => {
      const key = suppId || '__no_supplier__';
      if (!landBySupplier[key]) landBySupplier[key] = { cost: 0, sell: 0, items: [] };
      landBySupplier[key].cost += cost;
      landBySupplier[key].sell += sell;
      landBySupplier[key].items.push(desc);
    };

    (activitiesAll || []).forEach(a => {
      if (a.is_optional) return;
      let cp: number, sp: number;
      if (a.option_mode === 'dual') {
        cp = Number(a.confirmed_cp) || 0;
        sp = Number(a.confirmed_sp) || 0;
      } else {
        cp = Number(a.pvt_cp) || Number(a.sic_cp) || 0;
        sp = Number(a.pvt_sp) || Number(a.sic_sp) || 0;
      }
      if (cp > 0 || sp > 0) {
        addLand(a.supplier_id, cp, sp, `${a.type}: ${a.location || ''}`);
      }
    });

    (lineItemsAll || []).forEach(li => {
      if (!li.is_included || li.is_optional) return;
      const cp = Number(li.cp) || 0;
      const sp = Number(li.sp) || 0;
      if (cp > 0 || sp > 0) {
        addLand(li.supplier_id, cp, sp, li.description || li.type);
      }
    });

    for (const [suppKey, land] of Object.entries(landBySupplier)) {
      const supplierId = suppKey === '__no_supplier__' ? null : suppKey;
      const { data: booking } = await supabase.from('bookings').insert({
        ...common,
        supplier_id: supplierId,
        booking_type: 'land',
        title: `Land Services – ${proposal.destination || 'Trip'}`,
        cost_price: Math.round(land.cost * 100) / 100,
        sell_price: Math.round(land.sell * 100) / 100,
      }).select().single();

      if (booking) {
        createdBookings.push(booking);
        await createDefaultInstallments(supabase, booking.id, booking.cost_price, travelStart);
        await logBookingCreated(supabase, booking.id, userId, proposalId, 'land');
      }
    }

    // --- Flights: group by supplier ---
    const { data: flights } = await supabase
      .from('flights')
      .select('supplier_id, airline, flight_number, cp_total, sp_total')
      .eq('proposal_id', proposalId)
      .order('sort_order');

    const flightsBySupplier: Record<string, { cost: number; sell: number; airlines: string[] }> = {};
    (flights || []).forEach(f => {
      const key = f.supplier_id || '__no_supplier__';
      if (!flightsBySupplier[key]) flightsBySupplier[key] = { cost: 0, sell: 0, airlines: [] };
      flightsBySupplier[key].cost += Number(f.cp_total) || 0;
      flightsBySupplier[key].sell += Number(f.sp_total) || 0;
      if (f.airline && !flightsBySupplier[key].airlines.includes(f.airline)) {
        flightsBySupplier[key].airlines.push(f.airline);
      }
    });

    for (const [suppKey, fg] of Object.entries(flightsBySupplier)) {
      const supplierId = suppKey === '__no_supplier__' ? null : suppKey;
      const { data: booking } = await supabase.from('bookings').insert({
        ...common,
        supplier_id: supplierId,
        booking_type: 'flight',
        title: fg.airlines.length ? fg.airlines.join(', ') : `Flights – ${proposal.destination || 'Trip'}`,
        cost_price: Math.round(fg.cost * 100) / 100,
        sell_price: Math.round(fg.sell * 100) / 100,
      }).select().single();

      if (booking) {
        createdBookings.push(booking);
        await createDefaultInstallments(supabase, booking.id, booking.cost_price, travelStart);
        await logBookingCreated(supabase, booking.id, userId, proposalId, 'flight');
      }
    }
  }

  return createdBookings;
}

async function createDefaultInstallments(
  supabase: ReturnType<typeof createServiceClient>,
  bookingId: string,
  costPrice: number,
  travelStart: Date,
) {
  if (costPrice <= 0) return;

  const advanceAmount = Math.round(costPrice * 30) / 100;
  const balanceAmount = Math.round((costPrice - advanceAmount) * 100) / 100;

  const balanceDueDate = new Date(travelStart);
  balanceDueDate.setDate(balanceDueDate.getDate() - 30);
  const today = new Date();
  if (balanceDueDate < today) balanceDueDate.setTime(today.getTime());

  const installments = [
    {
      booking_id: bookingId,
      installment_label: '30% advance',
      installment_number: 1,
      amount: advanceAmount,
      due_date: new Date().toISOString().split('T')[0],
      status: 'pending',
    },
  ];

  if (balanceAmount > 0) {
    installments.push({
      booking_id: bookingId,
      installment_label: '70% balance',
      installment_number: 2,
      amount: balanceAmount,
      due_date: balanceDueDate.toISOString().split('T')[0],
      status: 'pending',
    });
  }

  await supabase.from('booking_payments').insert(installments);
}

async function logBookingCreated(
  supabase: ReturnType<typeof createServiceClient>,
  bookingId: string,
  userId: string,
  proposalId: string,
  bookingType: string,
) {
  await supabase.from('booking_logs').insert({
    booking_id: bookingId,
    user_id: userId,
    action: 'booking_created',
    details: { proposal_id: proposalId, booking_type: bookingType },
  });
}
