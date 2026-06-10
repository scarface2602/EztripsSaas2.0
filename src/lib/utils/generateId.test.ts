import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateTripId,
  generateTripIdFromDb,
  parseTripId,
  requirementToServiceType,
  DEFAULT_TRIP_ID_CONFIG,
  type TripIdConfig,
} from './generateId';

afterEach(() => {
  vi.useRealTimers();
});

describe('generateTripId (client preview)', () => {
  it('uses the default EZQ + type + YYMMDD + 3-digit seq format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T10:00:00'));
    const id = generateTripId('PKG');
    expect(id).toMatch(/^EZQPKG260611\d{3}$/);
  });

  it('respects a custom org config (prefix, separator, date format)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T10:00:00'));
    const config: TripIdConfig = {
      prefix: 'TRV',
      separator: '-',
      date_format: 'YYYYMMDD',
      seq_digits: 4,
      type_codes: { PKG: 'PK' },
    };
    const id = generateTripId('PKG', config);
    expect(id).toMatch(/^TRV-PK-20260611-\d{4}$/);
  });
});

describe('generateTripIdFromDb', () => {
  it('uses the DB sequence and zero-pads it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T10:00:00'));
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: 7, error: null }),
    };
    const id = await generateTripIdFromDb(supabase, 'HTL');
    expect(supabase.rpc).toHaveBeenCalledWith('next_trip_sequence', { period_key: '260611' });
    expect(id).toBe('EZQHTL260611007');
  });

  it('falls back to a timestamp suffix when the RPC fails', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }),
    };
    const id = await generateTripIdFromDb(supabase, 'PKG');
    expect(id).toMatch(/^EZQPKG\d{6}\d{5,}$/);
  });
});

describe('parseTripId', () => {
  it('round-trips a default-format ID', () => {
    expect(parseTripId('EZQPKG260611001')).toEqual({
      serviceType: 'PKG',
      date: '260611',
      sequence: '001',
    });
  });

  it('returns null for garbage', () => {
    expect(parseTripId('not-an-id')).toBeNull();
  });
});

describe('requirementToServiceType', () => {
  it('maps known requirement types', () => {
    expect(requirementToServiceType('package')).toBe('PKG');
    expect(requirementToServiceType('hotel')).toBe('HTL');
    expect(requirementToServiceType('flight')).toBe('FLT');
    expect(requirementToServiceType('visa')).toBe('VSA');
    expect(requirementToServiceType('transfer')).toBe('TRF');
  });

  it('defaults unknown types to MISC', () => {
    expect(requirementToServiceType('cruise')).toBe('MISC');
  });
});

describe('DEFAULT_TRIP_ID_CONFIG', () => {
  it('matches the DB trigger format assumptions', () => {
    expect(DEFAULT_TRIP_ID_CONFIG.prefix).toBe('EZQ');
    expect(DEFAULT_TRIP_ID_CONFIG.seq_digits).toBe(3);
    expect(DEFAULT_TRIP_ID_CONFIG.date_format).toBe('YYMMDD');
  });
});
