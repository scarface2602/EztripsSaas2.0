import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

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
      // pdf-parse v2: instantiate → load → getText
      const { PDFParse } = await import('pdf-parse');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parser: any = new PDFParse({ data: new Uint8Array(buffer) });
      await parser.load();
      const pdfData = await parser.getText();
      text = typeof pdfData === 'string' ? pdfData : pdfData?.text || '';
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
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}
