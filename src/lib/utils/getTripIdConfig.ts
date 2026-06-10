import { DEFAULT_TRIP_ID_CONFIG, type TripIdConfig } from './generateId';

/**
 * Fetch the org's trip ID config. Returns default if no org or no config.
 */
export async function getTripIdConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  orgId?: string | null,
): Promise<TripIdConfig> {
  if (!orgId) return DEFAULT_TRIP_ID_CONFIG;

  const { data } = await supabase
    .from('organisations')
    .select('trip_id_config')
    .eq('id', orgId)
    .single();

  return (data?.trip_id_config as TripIdConfig) ?? DEFAULT_TRIP_ID_CONFIG;
}
