// GSTIN validation — format, state-code, and mod-36 checksum.
// Catches typos at entry so bad GSTINs never reach invoices or GSTR-1.

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GST state codes → state names (incl. UTs; 97 = Other Territory). */
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};

function checksumChar(gstin: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARS.indexOf(gstin[i]);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export function normalizeGstin(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Full GSTIN validation: 15-char format, known state code, checksum.
 * Returns an error message or null when valid.
 */
export function gstinError(raw: string): string | null {
  const gstin = normalizeGstin(raw);
  if (gstin.length !== 15) return 'GSTIN must be exactly 15 characters';
  if (!GSTIN_REGEX.test(gstin)) return 'Not a valid GSTIN format (e.g. 27AAPFU0939F1ZV)';
  if (!GST_STATE_CODES[gstin.slice(0, 2)]) return `Unknown state code "${gstin.slice(0, 2)}"`;
  if (checksumChar(gstin) !== gstin[14]) return 'GSTIN checksum failed — please re-check for typos';
  return null;
}

export function isValidGstin(raw: string): boolean {
  return gstinError(raw) === null;
}

/** State code (first 2 digits) of a structurally valid GSTIN, else null. */
export function gstinStateCode(raw: string): string | null {
  const gstin = normalizeGstin(raw);
  const code = gstin.slice(0, 2);
  return GST_STATE_CODES[code] ? code : null;
}

/** PAN embedded in a GSTIN (chars 3–12), else null. */
export function gstinPan(raw: string): string | null {
  const gstin = normalizeGstin(raw);
  return GSTIN_REGEX.test(gstin) ? gstin.slice(2, 12) : null;
}
