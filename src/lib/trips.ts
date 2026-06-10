import { createServiceClient } from '@/lib/supabase/server';

type TripStatus = 'ENQUIRY' | 'PROPOSING' | 'ACTIVE_BOOKING' | 'COMPLETED';

const STATUS_RANK: Record<TripStatus, number> = {
  ENQUIRY: 0,
  PROPOSING: 1,
  ACTIVE_BOOKING: 2,
  COMPLETED: 3,
};

/**
 * Make sure a trips master-folder row exists for a trip_id, advancing its
 * status if the pipeline moved forward. Status never moves backwards —
 * a new proposal on an already-booked trip must not demote it.
 */
export async function ensureTripFolder(
  supabase: ReturnType<typeof createServiceClient>,
  tripId: string,
  fields: {
    status: TripStatus;
    client_id?: string | null;
    destination?: string | null;
    travel_start?: string | null;
    travel_end?: string | null;
    pax_adults?: number;
    pax_children?: number;
    created_by?: string | null;
  },
): Promise<void> {
  const { data: existing } = await supabase
    .from('trips')
    .select('id, status')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (existing) {
    const currentRank = STATUS_RANK[existing.status as TripStatus] ?? 0;
    const updates: Record<string, unknown> = {};
    if (STATUS_RANK[fields.status] > currentRank) updates.status = fields.status;
    if (fields.client_id) updates.client_id = fields.client_id;
    if (fields.destination) updates.destination = fields.destination;
    if (fields.travel_start) updates.travel_start = fields.travel_start;
    if (fields.travel_end) updates.travel_end = fields.travel_end;
    if (Object.keys(updates).length > 0) {
      await supabase.from('trips').update(updates).eq('id', existing.id);
    }
    return;
  }

  await supabase.from('trips').insert({
    trip_id: tripId,
    status: fields.status,
    client_id: fields.client_id ?? null,
    destination: fields.destination ?? null,
    travel_start: fields.travel_start ?? null,
    travel_end: fields.travel_end ?? null,
    pax_adults: fields.pax_adults ?? 1,
    pax_children: fields.pax_children ?? 0,
    created_by: fields.created_by ?? null,
  });
}

/**
 * Prefix an email subject with the trip reference so clients and suppliers
 * quote it back, and replies thread per trip. Idempotent.
 */
export function withTripRef(subject: string, tripId?: string | null): string {
  if (!tripId || subject.includes(tripId)) return subject;
  return `[${tripId}] ${subject}`;
}

/** Record a proposal against its trip's master folder. */
export async function appendProposalToTrip(
  supabase: ReturnType<typeof createServiceClient>,
  tripId: string,
  proposalId: string,
): Promise<void> {
  const { data: trip } = await supabase
    .from('trips')
    .select('id, proposal_ids')
    .eq('trip_id', tripId)
    .maybeSingle();
  if (!trip) return;
  const ids: string[] = Array.isArray(trip.proposal_ids) ? trip.proposal_ids : [];
  if (ids.includes(proposalId)) return;
  await supabase.from('trips').update({ proposal_ids: [...ids, proposalId] }).eq('id', trip.id);
}
