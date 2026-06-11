// itinerary_activities rows ↔ Builder v2 DayBlock shape.
// Title/description live in the row's details JSONB; SIC/PVT maps to
// the table's option_mode (pvt_only/sic_only).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function blocksForDay(rows: any[], dayId: string) {
  return rows
    .filter((b) => b.itinerary_day_id === dayId)
    .map((b) => ({
      id: b.id,
      type: b.type ?? 'activity',
      title: (b.details?.title as string) ?? '',
      description: (b.details?.description as string) ?? null,
      transfer_mode: b.option_mode === 'pvt_only' ? 'PVT' : b.option_mode === 'sic_only' ? 'SIC' : null,
      start_time: b.start_time ? String(b.start_time).slice(0, 5) : null,
      library_id: (b.details?.library_id as number) ?? null,
      sort_order: b.sort_order ?? 0,
    }));
}

export interface BlockInput {
  id: string;
  type: string;
  title: string;
  description: string | null;
  transfer_mode: 'SIC' | 'PVT' | null;
  start_time: string | null;
  library_id: number | null;
  sort_order: number;
}

export function blockToRow(block: BlockInput, proposalId: string, dayId: string) {
  return {
    id: block.id,
    proposal_id: proposalId,
    itinerary_day_id: dayId,
    type: block.type,
    option_mode: block.transfer_mode === 'PVT' ? 'pvt_only' : block.transfer_mode === 'SIC' ? 'sic_only' : null,
    start_time: block.start_time || null,
    details: { title: block.title, description: block.description, library_id: block.library_id },
    sort_order: block.sort_order,
    show_in_pdf: true,
  };
}
