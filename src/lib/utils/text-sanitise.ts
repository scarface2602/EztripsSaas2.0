/**
 * Pre-PDF text sanitisation — pure regex/string manipulation.
 * Cleans junk characters from DMC quote text before rendering in PDF.
 * Does NOT change content meaning or proper nouns.
 */

export function cleanText(text: string | null | undefined): string {
  if (!text) return '';

  return text
    // Remove standalone markdown-style characters at start of lines
    .replace(/^[\s]*[-*#|>~]+\s*/gm, '')
    // Remove multiple consecutive blank lines (keep max one)
    .replace(/\n{3,}/g, '\n\n')
    // Remove multiple consecutive spaces
    .replace(/ {2,}/g, ' ')
    // Fix double punctuation (.. -> ., ,, -> ,, :: -> :)
    .replace(/\.{2,}/g, '.')
    .replace(/,{2,}/g, ',')
    .replace(/:{2,}/g, ':')
    .replace(/;{2,}/g, ';')
    // Fix space before punctuation
    .replace(/ +([.,;:!?])/g, '$1')
    // Trim each line
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    // Trim overall
    .trim();
}
