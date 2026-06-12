/**
 * Semantic Trip ID Generator
 * Default format: EZQ{TYPE}{YYMMDD}{3-digit seq}
 * Customizable per org via TripIdConfig.
 */

export type ServiceType = 'PKG' | 'HTL' | 'FLT' | 'VSA' | 'TRF' | 'TRN' | 'INS' | 'MISC';

export interface TripIdConfig {
  prefix: string;
  separator: string;
  date_format: 'YYMMDD' | 'YYYYMMDD';
  seq_digits: number;
  type_codes: Record<string, string>;
}

export const DEFAULT_TRIP_ID_CONFIG: TripIdConfig = {
  prefix: 'EZQ',
  separator: '',
  date_format: 'YYMMDD',
  seq_digits: 3,
  type_codes: { PKG: 'PKG', HTL: 'HTL', FLT: 'FLT', VSA: 'VSA', TRF: 'TRF', TRN: 'TRN', INS: 'INS', MISC: 'MISC' },
};

function buildDatePart(config: TripIdConfig): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  if (config.date_format === 'YYYYMMDD') return `${yyyy}${mm}${dd}`;
  return `${yyyy.slice(2)}${mm}${dd}`;
}

function buildTripId(config: TripIdConfig, serviceType: ServiceType, seq: string): string {
  const sep = config.separator;
  const typeCode = config.type_codes[serviceType] || serviceType;
  const datePart = buildDatePart(config);
  return `${config.prefix}${sep}${typeCode}${sep}${datePart}${sep}${seq}`;
}

let sequenceCounter = 0;
let lastDay = '';

/**
 * Generate a semantic trip ID (client-side preview only).
 */
export function generateTripId(serviceType: ServiceType, config?: TripIdConfig): string {
  const c = config ?? DEFAULT_TRIP_ID_CONFIG;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const period = `${yy}${mm}${dd}`;

  if (period !== lastDay) {
    sequenceCounter = 0;
    lastDay = period;
  }

  sequenceCounter++;
  const seq = String(sequenceCounter).padStart(c.seq_digits, '0');
  return buildTripId(c, serviceType, seq);
}

/**
 * Server-side trip ID generator using a Supabase sequence.
 */
export async function generateTripIdFromDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { rpc: (fn: string, args?: Record<string, unknown>) => any },
  serviceType: ServiceType,
  config?: TripIdConfig,
): Promise<string> {
  const c = config ?? DEFAULT_TRIP_ID_CONFIG;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const period = `${yy}${mm}${dd}`;

  const { data: seq, error } = await supabase.rpc('next_trip_sequence', { period_key: period });

  if (error || seq == null) {
    const fallback = String(Date.now()).slice(-Math.max(c.seq_digits, 5));
    return buildTripId(c, serviceType, fallback);
  }

  return buildTripId(c, serviceType, String(seq).padStart(c.seq_digits, '0'));
}

/**
 * Parse a trip ID back into its components (best-effort, default format).
 */
export function parseTripId(tripId: string): {
  serviceType: string;
  date: string;
  sequence: string;
} | null {
  const compact = tripId.replace(/[-/]/g, '');
  const match = compact.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const [, letters, digits] = match;

  // Date is YYMMDD (6) or YYYYMMDD (8) followed by a sequence of >= 2 digits.
  const dateLen = digits.length >= 10 ? 8 : 6;
  if (digits.length < dateLen + 2) return null;
  const date = digits.slice(0, dateLen);
  const sequence = digits.slice(dateLen);

  const upper = letters.toUpperCase();
  const knownTypes = ['MISC', 'PKG', 'HTL', 'FLT', 'VSA', 'TRF'];
  const serviceType = knownTypes.find(t => upper.endsWith(t)) ?? upper.slice(-3);

  return { serviceType, date, sequence };
}

/**
 * Map requirement_type to ServiceType for trip ID generation.
 */
export function requirementToServiceType(requirementType: string): ServiceType {
  const map: Record<string, ServiceType> = {
    package: 'PKG',
    hotel: 'HTL',
    flight: 'FLT',
    visa: 'VSA',
    transfer: 'TRF',
  };
  return map[requirementType] || 'MISC';
}
