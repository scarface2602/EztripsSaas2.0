import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Use pdfjs-dist directly — pure JS, works on Vercel (no native bindings)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: unknown) => typeof item === 'object' && item !== null && 'str' in item)
      .map((item: unknown) => (item as Record<string, unknown>).str as string);
    pages.push(strings.join(' '));
  }
  return pages.join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceType = formData.get('source_type') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (sourceType === 'pdf') {
      text = await extractPdfText(buffer);
    } else {
      // Excel/CSV
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: string[] = [];
      workbook.SheetNames.forEach((name) => {
        const sheet = workbook.Sheets[name];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        sheets.push(JSON.stringify(json, null, 2));
      });
      text = sheets.join('\n\n');
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 422 });
    }

    return NextResponse.json({ text, source_type: sourceType });
  } catch (err) {
    console.error('Quote import error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to parse file: ${msg}` }, { status: 500 });
  }
}
