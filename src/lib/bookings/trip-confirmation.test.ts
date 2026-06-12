import { describe, it, expect } from 'vitest';
import {
  deriveTripConfirmation,
  effectiveSupplierReference,
  type TripConfirmationItem,
} from './trip-confirmation';

function item(overrides: Partial<TripConfirmationItem> = {}): TripConfirmationItem {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    item_type: 'hotel_room',
    label: 'Test Hotel',
    supplier_status: 'pending',
    supplier_reference: null,
    start_date: '2026-07-01',
    updated_at: '2026-06-01T00:00:00Z',
    details: {},
    ...overrides,
  };
}

describe('deriveTripConfirmation', () => {
  it('is not ready when there are no items', () => {
    const s = deriveTripConfirmation([]);
    expect(s.ready).toBe(false);
    expect(s.blockingItems).toHaveLength(0);
  });

  it('blocks on pending items and becomes ready when all confirm', () => {
    const pending = item({ label: 'Hotel A' });
    const confirmed = item({ supplier_status: 'confirmed', supplier_reference: 'REF1' });
    let s = deriveTripConfirmation([pending, confirmed]);
    expect(s.ready).toBe(false);
    expect(s.blockingItems.map((i) => i.label)).toEqual(['Hotel A']);

    s = deriveTripConfirmation([
      { ...pending, supplier_status: 'confirmed', supplier_reference: 'REF2' },
      confirmed,
    ]);
    expect(s.ready).toBe(true);
  });

  it('treats completed as confirmed and ignores cancelled items', () => {
    const s = deriveTripConfirmation([
      item({ supplier_status: 'completed', supplier_reference: 'R1' }),
      item({ supplier_status: 'cancelled' }),
    ]);
    expect(s.ready).toBe(true);
    expect(s.activeItems).toHaveLength(1);
  });

  it('does not gate on items covered by a DMC package', () => {
    const dmc = item({
      item_type: 'dmc_package',
      label: 'Bali Land Package',
      supplier_status: 'confirmed',
      supplier_reference: 'DMC-99',
      start_date: null,
    });
    const coveredHotel = item({
      label: 'Covered Hotel',
      supplier_status: 'pending',
      details: { covered_by: 'Bali Land Package' },
    });
    const s = deriveTripConfirmation([dmc, coveredHotel]);
    expect(s.ready).toBe(true);
    expect(s.gateItems).toHaveLength(1);
    expect(s.activeItems).toHaveLength(2);
  });

  it('warns on confirmed items without a supplier reference', () => {
    const s = deriveTripConfirmation([item({ supplier_status: 'confirmed', label: 'Hotel B' })]);
    expect(s.ready).toBe(true);
    expect(s.warnings.some((w) => w.id.startsWith('no-ref-') && w.message.includes('Hotel B'))).toBe(true);
  });

  it('warns on undated items but not on undated DMC packages', () => {
    const s = deriveTripConfirmation([
      item({ supplier_status: 'confirmed', supplier_reference: 'R', start_date: null, label: 'Loose Transfer', item_type: 'transfer' }),
      item({ item_type: 'dmc_package', supplier_status: 'confirmed', supplier_reference: 'R2', start_date: null }),
    ]);
    const dateWarnings = s.warnings.filter((w) => w.id.startsWith('no-date-'));
    expect(dateWarnings).toHaveLength(1);
    expect(dateWarnings[0].message).toContain('Loose Transfer');
  });

  it('flags staleness when an item changed after the latest trip voucher', () => {
    const items = [item({ supplier_status: 'confirmed', supplier_reference: 'R', updated_at: '2026-06-10T00:00:00Z' })];
    const fresh = deriveTripConfirmation(items, [
      { voucher_type: 'package', pdf_generated_at: '2026-06-11T00:00:00Z', created_at: '2026-06-11T00:00:00Z' },
    ]);
    expect(fresh.stale).toBe(false);

    const stale = deriveTripConfirmation(items, [
      { voucher_type: 'package', pdf_generated_at: '2026-06-09T00:00:00Z', created_at: '2026-06-09T00:00:00Z' },
      { voucher_type: 'hotel', pdf_generated_at: '2026-06-11T00:00:00Z', created_at: '2026-06-11T00:00:00Z' },
    ]);
    expect(stale.stale).toBe(true);
    expect(stale.latestVoucher?.voucher_type).toBe('package');
  });
});

describe('effectiveSupplierReference', () => {
  const dmc = item({
    item_type: 'dmc_package',
    label: 'Land Package',
    supplier_status: 'confirmed',
    supplier_reference: 'DMC-7',
  });

  it('prefers the item own reference', () => {
    const i = item({ supplier_reference: 'OWN-1', details: { covered_by: 'Land Package' } });
    expect(effectiveSupplierReference(i, [dmc, i])).toBe('OWN-1');
  });

  it('falls back to the covering DMC package reference', () => {
    const i = item({ details: { covered_by: 'Land Package' } });
    expect(effectiveSupplierReference(i, [dmc, i])).toBe('DMC-7');
  });

  it('returns empty when uncovered and unreferenced', () => {
    const i = item({});
    expect(effectiveSupplierReference(i, [dmc, i])).toBe('');
  });
});
