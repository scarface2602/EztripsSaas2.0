import { describe, it, expect } from 'vitest';
import { gstinError, isValidGstin, gstinStateCode, gstinPan, normalizeGstin } from './gstin';

// Checksums independently verified against the mod-36 algorithm.
const VALID = ['27AAPFU0939F1ZV', '07AAGFF2194N1Z1'];

describe('gstin validation', () => {
  it('accepts known-valid GSTINs', () => {
    for (const g of VALID) expect(gstinError(g)).toBeNull();
  });

  it('normalizes case and whitespace before validating', () => {
    expect(isValidGstin(' 27aapfu0939f1zv ')).toBe(true);
    expect(normalizeGstin(' 27aapfu0939f1zv ')).toBe('27AAPFU0939F1ZV');
  });

  it('rejects wrong length', () => {
    expect(gstinError('27AAPFU0939F1Z')).toMatch(/15 characters/);
  });

  it('rejects bad format', () => {
    expect(gstinError('27AAPFU0939F1AV')).toMatch(/format/);
  });

  it('rejects unknown state codes', () => {
    expect(gstinError('99AAPFU0939F1ZV')).toMatch(/state code/);
  });

  it('rejects a single-character typo via checksum', () => {
    expect(gstinError('27AAPFU0939F1ZX')).toMatch(/checksum/);
    expect(gstinError('27AAPFU0938F1ZV')).toMatch(/checksum/);
  });

  it('extracts state code and PAN', () => {
    expect(gstinStateCode('27AAPFU0939F1ZV')).toBe('27');
    expect(gstinPan('27AAPFU0939F1ZV')).toBe('AAPFU0939F');
    expect(gstinStateCode('99AAPFU0939F1ZV')).toBeNull();
  });
});
