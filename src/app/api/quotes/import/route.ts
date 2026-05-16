import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
// Import pdf-parse internals directly to avoid the test file read in index.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

export const maxDuration = 60;

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
      const data = await pdf(buffer);
      text = data.text;
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
