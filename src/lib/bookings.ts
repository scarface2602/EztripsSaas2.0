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

  // Fetch all proposal components upfront
  const [
    { data: hotelsAll },
    { data: flightsAll },
    { data: activitiesAll },
    { data: lineItemsAll },
  ] = await Promise.all([
    supabase.from('hotels').select('*').eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('line_items').select('*').eq('proposal_id', proposalId).order('sort_order'),
  ]);

  if (proposal.quote_type === 'package') {
    const supplierId = hotelsAll?.[0]?.supplier_id || null;

    let totalCost = 0;
    (hotelsAll || []).forEach(h => { totalCost += (Number(h.cp_per_night) || 0) * (Number(h.nights) || 0); });
    (flightsAll || []).forEach(f => { totalCost += Number(f.cp_total) || 0; });
    (activitiesAll || []).forEach(a => {
      if (a.is_optional) return;
      if (a.option_mode === 'dual') totalCost += Number(a.confirmed_cp) || 0;
      else totalCost += Number(a.pvt_cp) || Number(a.sic_cp) || 0;
    });
    (lineItemsAll || []).forEach(li => {
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

      // Auto-create booking items from all proposal components
      await createItemsFromProposal(supabase, booking.id, {
        hotels: hotelsAll || [],
        flights: flightsAll || [],
        activities: activitiesAll || [],
        lineItems: lineItemsAll || [],
      });
    }
  } else {
    // Itemised: multiple bookings

    // --- Hotels: one booking per hotel ---
    for (const h of (hotelsAll || [])) {
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

        // Create hotel item
        await createItemsFromProposal(supabase, booking.id, {
          hotels: [h], flights: [], activities: [], lineItems: [],
        });
      }
    }

    // --- Land services: group by supplier ---
    const landBySupplier: Record<string, {
      cost: number; sell: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activities: any[]; lineItems: any[];
    }> = {};

    const addLand = (
      suppId: string | null,
      cost: number,
      sell: number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activityOrLineItem: any,
      isActivity: boolean,
    ) => {
      const key = suppId || '__no_supplier__';
      if (!landBySupplier[key]) landBySupplier[key] = { cost: 0, sell: 0, activities: [], lineItems: [] };
      landBySupplier[key].cost += cost;
      landBySupplier[key].sell += sell;
      if (isActivity) landBySupplier[key].activities.push(activityOrLineItem);
      else landBySupplier[key].lineItems.push(activityOrLineItem);
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
        addLand(a.supplier_id, cp, sp, a, true);
      }
    });

    (lineItemsAll || []).forEach(li => {
      if (!li.is_included || li.is_optional) return;
      const cp = Number(li.cp) || 0;
      const sp = Number(li.sp) || 0;
      if (cp > 0 || sp > 0) {
        addLand(li.supplier_id, cp, sp, li, false);
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

        // If single supplier covers everything → create one DMC package item
        // Otherwise create individual items
        const totalLandItems = land.activities.length + land.lineItems.length;
        if (totalLandItems > 1 && supplierId) {
          // DMC package — one consolidated item
          await supabase.from('booking_items').insert({
            booking_id: booking.id,
            item_type: 'dmc_package',
            label: `Land Package – ${proposal.destination || 'Trip'}`,
            start_date: proposal.travel_start,
            end_date: proposal.travel_end,
            cost_price: Math.round(land.cost * 100) / 100,
            sell_price: Math.round(land.sell * 100) / 100,
            supplier_status: 'pending',
            details: {
              activity_count: land.activities.length,
              line_item_count: land.lineItems.length,
              items_summary: [
                ...land.activities.map((a: Record<string, string>) => `${a.type}: ${a.location || ''}`),
                ...land.lineItems.map((li: Record<string, string>) => li.description || li.type),
              ],
            },
            sort_order: 0,
          });
        } else {
          await createItemsFromProposal(supabase, booking.id, {
            hotels: [], flights: [],
            activities: land.activities,
            lineItems: land.lineItems,
          });
        }
      }
    }

    // --- Flights: group by supplier ---
    const flightsBySupplier: Record<string, {
      cost: number; sell: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      airlines: string[]; flights: any[];
    }> = {};

    (flightsAll || []).forEach(f => {
      const key = f.supplier_id || '__no_supplier__';
      if (!flightsBySupplier[key]) flightsBySupplier[key] = { cost: 0, sell: 0, airlines: [], flights: [] };
      flightsBySupplier[key].cost += Number(f.cp_total) || 0;
      flightsBySupplier[key].sell += Number(f.sp_total) || 0;
      flightsBySupplier[key].flights.push(f);
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

        await createItemsFromProposal(supabase, booking.id, {
          hotels: [], flights: fg.flights, activities: [], lineItems: [],
        });
      }
    }
  }

  return createdBookings;
}

/**
 * Auto-create booking_items from proposal components.
 * All items start with supplier_status = 'pending'.
 */
async function createItemsFromProposal(
  supabase: ReturnType<typeof createServiceClient>,
  bookingId: string,
  components: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hotels: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flights: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activities: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineItems: any[];
  },
) {
  const items: Record<string, unknown>[] = [];
  let sortOrder = 0;

  // Hotels
  for (const h of components.hotels) {
    const nights = Number(h.nights) || Math.max(1, Math.round(
      (new Date(h.check_out).getTime() - new Date(h.check_in).getTime()) / 86400000
    ));
    items.push({
      booking_id: bookingId,
      item_type: 'hotel_room',
      label: `${h.name} – ${h.room_type || 'Standard'} (${h.city || ''})`,
      start_date: h.check_in,
      end_date: h.check_out,
      cost_price: Math.round((Number(h.cp_per_night) || 0) * nights * 100) / 100,
      sell_price: Math.round((Number(h.sp_per_night) || 0) * nights * 100) / 100,
      supplier_status: 'pending',
      details: {
        hotel_name: h.name,
        room_type: h.room_type,
        city: h.city,
        nights,
        meal_plan: h.meal_plan || 'RO',
        rooms_count: 1,
        star_rating: h.star_rating,
      },
      sort_order: sortOrder++,
    });
  }

  // Flights
  for (const f of components.flights) {
    items.push({
      booking_id: bookingId,
      item_type: 'flight_segment',
      label: `${f.origin_city || f.origin_iata || '?'} → ${f.destination_city || f.destination_iata || '?'}${f.airline ? ` (${f.airline}${f.flight_number ? ' ' + f.flight_number : ''})` : ''}`,
      start_date: f.departure_at ? f.departure_at.split('T')[0] : null,
      end_date: f.arrival_at ? f.arrival_at.split('T')[0] : null,
      cost_price: Number(f.cp_total) || null,
      sell_price: Number(f.sp_total) || null,
      supplier_status: 'pending',
      details: {
        airline: f.airline,
        flight_number: f.flight_number,
        origin_city: f.origin_city,
        origin_iata: f.origin_iata,
        destination_city: f.destination_city,
        destination_iata: f.destination_iata,
        cabin_class: f.cabin_class,
        departure_time: f.departure_at,
        arrival_time: f.arrival_at,
      },
      sort_order: sortOrder++,
    });
  }

  // Activities / transfers / sightseeing
  for (const a of components.activities) {
    if (a.is_optional) continue;
    let cp: number, sp: number;
    if (a.option_mode === 'dual') {
      cp = Number(a.confirmed_cp) || 0;
      sp = Number(a.confirmed_sp) || 0;
    } else {
      cp = Number(a.pvt_cp) || Number(a.sic_cp) || 0;
      sp = Number(a.pvt_sp) || Number(a.sic_sp) || 0;
    }

    const typeMap: Record<string, string> = {
      transfer: 'transfer',
      sightseeing: 'activity',
      activity: 'activity',
      meal: 'meal_plan',
    };
    const itemType = typeMap[a.type] || 'activity';

    items.push({
      booking_id: bookingId,
      item_type: itemType,
      label: a.type === 'transfer'
        ? `Transfer: ${a.location || ''}`
        : `${a.type}: ${a.location || ''}`,
      start_date: a.start_time ? a.start_time.split('T')[0] : null,
      end_date: null,
      cost_price: Math.round(cp * 100) / 100 || null,
      sell_price: Math.round(sp * 100) / 100 || null,
      supplier_status: 'pending',
      details: {
        location: a.location,
        activity_type: a.type,
        option_mode: a.option_mode,
      },
      sort_order: sortOrder++,
    });
  }

  // Line items (visa, surcharges, etc.)
  for (const li of components.lineItems) {
    if (!li.is_included || li.is_optional) continue;
    const cp = Number(li.cp) || 0;
    const sp = Number(li.sp) || 0;
    if (cp <= 0 && sp <= 0) continue;

    items.push({
      booking_id: bookingId,
      item_type: 'activity', // generic bucket
      label: li.description || li.type,
      start_date: li.date || null,
      end_date: null,
      cost_price: Math.round(cp * 100) / 100,
      sell_price: Math.round(sp * 100) / 100,
      supplier_status: 'pending',
      details: {
        line_item_type: li.type,
      },
      sort_order: sortOrder++,
    });
  }

  if (items.length > 0) {
    await supabase.from('booking_items').insert(items);
  }
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
