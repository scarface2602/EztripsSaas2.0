import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Polyfill DOMMatrix for Node.js (pdfjs-dist expects browser APIs)
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      a=1; b=0; c=0; d=1; e=0; f=0;
      m11=1; m12=0; m13=0; m14=0;
      m21=0; m22=1; m23=0; m24=0;
      m31=0; m32=0; m33=1; m34=0;
      m41=0; m42=0; m43=0; m44=1;
      is2D=true; isIdentity=true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(init?: any) {
        if (Array.isArray(init) && init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11=this.a; this.m12=this.b; this.m21=this.c; this.m22=this.d; this.m41=this.e; this.m42=this.f;
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
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
