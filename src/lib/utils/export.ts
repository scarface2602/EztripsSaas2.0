/**
 * prepareForExport — strips internal/supplier fields from the payload
 * before generating client-facing output (PDF, share link, etc.).
 *
 * Removes: supplier_id, supplier cost fields, zero-value EB/CWB/CNB.
 */

interface ExportableHotel {
  supplier_id?: string | null;
  cp_per_night?: number | null;
  sp_per_night?: number | null;
  cwb_cp?: number | null;
  cwb_sp?: number | null;
  cnb_cp?: number | null;
  cnb_sp?: number | null;
  [key: string]: unknown;
}

interface ExportableFlight {
  supplier_id?: string | null;
  cp_total?: number | null;
  [key: string]: unknown;
}

interface ExportableLineItem {
  supplier_id?: string | null;
  cp?: number | null;
  [key: string]: unknown;
}

export function prepareForExport(payload: {
  hotels: ExportableHotel[];
  flights: ExportableFlight[];
  lineItems: ExportableLineItem[];
}): {
  hotels: Record<string, unknown>[];
  flights: Record<string, unknown>[];
  lineItems: Record<string, unknown>[];
} {
  const hotels = payload.hotels.map((h) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { supplier_id, cp_per_night, ...rest } = h;
    const cleaned = { ...rest };
    if (!cleaned.sp_per_night) delete cleaned.sp_per_night;
    if (!cleaned.cwb_cp) delete cleaned.cwb_cp;
    if (!cleaned.cwb_sp) delete cleaned.cwb_sp;
    if (!cleaned.cnb_cp) delete cleaned.cnb_cp;
    if (!cleaned.cnb_sp) delete cleaned.cnb_sp;
    return cleaned;
  });

  const flights = payload.flights.map((f) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { supplier_id, cp_total, ...rest } = f;
    return rest;
  });

  const lineItems = payload.lineItems.map((li) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { supplier_id, cp, ...rest } = li;
    return rest;
  });

  return { hotels, flights, lineItems };
}
