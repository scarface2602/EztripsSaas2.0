import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { GST_STATE_CODES } from '@/lib/utils/gstin';

export const dynamic = 'force-dynamic';

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET /api/exports/gstr1?month=YYYY-MM — GSTR-1-shaped CSV for the CA:
// B2B rows per tax invoice (keyed by recipient GSTIN), B2C rows summarised
// per rate/POS, CDNR rows for credit notes. Cash sales are included in
// B2C — everything stays on the books.
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'accounts.manage' });
    if (auth instanceof NextResponse) return auth;

    const month = request.nextUrl.searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month=YYYY-MM is required' }, { status: 400 });
    }
    const from = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // first of next month

    const supabase = createServiceClient();
    let query = supabase
      .from('invoices')
      .select('*, client:clients(full_name)')
      .gte('created_at', from)
      .lt('created_at', to)
      .not('status', 'in', '("cancelled","void")')
      .in('invoice_type', ['final', 'credit_note'])
      .order('created_at');

    if (auth.user.role !== 'super_admin' && auth.user.org_id) {
      const { data: orgUsers } = await supabase.from('users').select('id').eq('org_id', auth.user.org_id);
      const ids = (orgUsers || []).map((u: { id: string }) => u.id);
      if (ids.length > 0) query = query.in('created_by', ids);
    }

    const { data: invoices, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const header = [
      'Section', 'Recipient GSTIN', 'Recipient Name', 'Invoice No', 'Invoice Date',
      'Invoice Value', 'Place of Supply', 'Rate %', 'Taxable Value',
      'IGST', 'CGST', 'SGST', 'TCS', 'Tax Class', 'SAC', 'Original Invoice (CDNR)',
    ];
    const rows: string[] = [header.join(',')];

    // B2C is summarised per rate + POS
    const b2cBuckets = new Map<string, { pos: string; rate: number | null; taxable: number; igst: number; cgst: number; sgst: number; value: number }>();
    const originalNumbers = new Map<string, string>();
    for (const inv of invoices || []) originalNumbers.set(inv.id, inv.invoice_number);

    for (const inv of invoices || []) {
      const posLabel = inv.place_of_supply
        ? `${inv.place_of_supply}-${GST_STATE_CODES[inv.place_of_supply] || ''}`
        : '';
      const date = String(inv.created_at).slice(0, 10);
      const common = [
        inv.invoice_number, date, Number(inv.total) || 0, posLabel,
        inv.tax_rate ?? '', inv.taxable_value ?? '',
        Number(inv.igst_amount) || 0, Number(inv.cgst_amount) || 0, Number(inv.sgst_amount) || 0,
        Number(inv.tcs_amount) || 0, inv.tax_class || '', inv.sac_code || '',
      ];

      if (inv.invoice_type === 'credit_note') {
        const orig = inv.reference_invoice_id ? originalNumbers.get(inv.reference_invoice_id) || '' : '';
        rows.push(['CDNR', inv.recipient_gstin || '', inv.recipient_legal_name || inv.client?.full_name || '', ...common, orig].map(esc).join(','));
      } else if (inv.is_tax_invoice && inv.recipient_gstin) {
        rows.push(['B2B', inv.recipient_gstin, inv.recipient_legal_name || inv.client?.full_name || '', ...common, ''].map(esc).join(','));
      } else {
        const key = `${inv.place_of_supply || ''}|${inv.tax_rate ?? ''}`;
        const b = b2cBuckets.get(key) || { pos: posLabel, rate: inv.tax_rate, taxable: 0, igst: 0, cgst: 0, sgst: 0, value: 0 };
        b.taxable += Number(inv.taxable_value) || 0;
        b.igst += Number(inv.igst_amount) || 0;
        b.cgst += Number(inv.cgst_amount) || 0;
        b.sgst += Number(inv.sgst_amount) || 0;
        b.value += Number(inv.total) || 0;
        b2cBuckets.set(key, b);
      }
    }

    const r2 = (n: number) => Math.round(n * 100) / 100;
    for (const b of Array.from(b2cBuckets.values())) {
      rows.push(['B2CS', '', '', '', '', r2(b.value), b.pos, b.rate ?? '', r2(b.taxable), r2(b.igst), r2(b.cgst), r2(b.sgst), 0, '', '', ''].map(esc).join(','));
    }

    return new NextResponse(rows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gstr1-${month}.csv"`,
      },
    });
  } catch (err) {
    console.error('GSTR-1 export error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
