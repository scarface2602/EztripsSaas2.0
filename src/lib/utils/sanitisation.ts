/**
 * AI Sanitisation Layer (SPEC.md Section 7)
 * Regex blacklist checker for description fields after GPT-4o parsing.
 */

const BLACKLIST_PATTERN = /net\b|nett\b|internal|confidential|ref\s*#|agent\s+rate|cost\s+price|margin|do\s+not\s+share|booking\s+id/i;

export interface SanitisationResult {
  clean: boolean;
  flaggedFields: string[];
}

export function checkSanitisation(fields: Record<string, string | null | undefined>): SanitisationResult {
  const flaggedFields: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value && BLACKLIST_PATTERN.test(value)) {
      flaggedFields.push(key);
    }
  }

  return {
    clean: flaggedFields.length === 0,
    flaggedFields,
  };
}

export function sanitiseText(text: string): string {
  // Remove known problematic patterns from text
  return text
    .replace(/\b(net|nett)\s+(rate|price|cost)\b/gi, '')
    .replace(/\b(confidential|internal|do not share)\b/gi, '')
    .replace(/ref\s*#\s*\w+/gi, '')
    .replace(/booking\s*id\s*[:=]\s*\w+/gi, '')
    .replace(/agent\s+rate\b/gi, '')
    .replace(/cost\s+price\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const SANITISATION_SYSTEM_PROMPT = `CRITICAL: Strip all of the following from any description or notes fields before returning:
- Supplier names, company names, internal codes
- The words: net, nett, confidential, internal, do not share, agent rate, cost, margin
- Any monetary amounts in description fields (pricing goes in dedicated price fields only)
- Internal reference numbers (e.g. "Ref #9922", "Booking ID: XYZ")
- Any instruction to the reader not to share content
Return ONLY client-appropriate descriptive text in description fields.`;
