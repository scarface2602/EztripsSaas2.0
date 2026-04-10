import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const sourceType = formData.get('source_type') as string;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = '';

  if (sourceType === 'pdf') {
    // pdf-parse v2 exports PDFParse class
    const pdfMod = await import('pdf-parse') as unknown as Record<string, unknown>;
    const PdfParser = (pdfMod.PDFParse || pdfMod.default) as new (opts: { data: Uint8Array }) => { parse: () => Promise<{ text: string }> };
    const parser = new PdfParser({ data: new Uint8Array(buffer) });
    const pdfData = await parser.parse();
    text = pdfData.text;
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

  return NextResponse.json({ text, source_type: sourceType });
}
