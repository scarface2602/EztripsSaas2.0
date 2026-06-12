import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { GST_STATE_CODES } from '@/lib/utils/gstin';

export const dynamic = 'force-dynamic';

const x = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const tallyDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '');

function ledgerXml(name: string, parent: string, extra = ''): string {
  return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <LEDGER NAME="${x(name)}" ACTION="Create">
    <NAME.LIST><NAME>${x(name)}</NAME></NAME.LIST>
    <PARENT>${x(parent)}</PARENT>${extra}
  </LEDGER>
</TALLYMESSAGE>`;
}

// GET /api/exports/tally?from=YYYY-MM-DD&to=YYYY-MM-DD — one-way Tally
// Prime XML: ledger masters (billing entities as Sundry Debtors with
// GSTIN, payment accounts as Bank/Cash), Sales vouchers per booking, and
// Receipt vouchers per client receipt with bill-wise allocation by trip ID.
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'accounts.manage' });
    if (auth instanceof NextResponse) return auth;

    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    if (!from || !to) return NextResponse.json({ error: 'from and to (YYYY-MM-DD) are required' }, { status: 400 });

    const supabase = createServiceClient();
    let creatorIds: string[] | null = null;
    if (auth.user.role !== 'super_admin' && auth.user.org_id) {
      const { data: orgUsers } = await supabase.from('users').select('id').eq('org_id', auth.user.org_id);
      creatorIds = (orgUsers || []).map((u: { id: string }) => u.id);
    }

    let bookingsQuery = supabase
      .from('bookings')
      .select(`id, trip_id, title, sell_price, created_at, status,
        client:clients!bookings_client_id_fkey(id, full_name, gstin, gst_state_code),
        bill_to:clients!bookings_bill_to_client_id_fkey(id, full_name, gstin, gst_state_code)`)
      .gte('created_at', from)
      .lte('created_at', `${to}T23:59:59`)
      .neq('status', 'cancelled')
      .order('created_at');
    if (creatorIds && creatorIds.length > 0) bookingsQuery = bookingsQuery.in('created_by', creatorIds);

    const [{ data: bookings, error: bErr }, { data: receipts }] = await Promise.all([
      bookingsQuery,
      supabase
        .from('client_receipts')
        .select('*, client:clients(full_name), account:payment_accounts(account_name, account_type), allocations:client_receipt_allocations(amount, booking:bookings(trip_id, title))')
        .eq('status', 'active')
        .gte('received_on', from)
        .lte('received_on', to)
        .order('received_on'),
    ]);
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    // ── Ledger masters ──
    type Party = { full_name: string; gstin?: string | null; gst_state_code?: string | null };
    const parties = new Map<string, Party>();
    for (const b of bookings || []) {
      const p = (b.bill_to || b.client) as unknown as Party | null;
      if (p?.full_name) parties.set(p.full_name, p);
    }
    for (const r of receipts || []) {
      const name = (r.client as { full_name?: string } | null)?.full_name;
      if (name && !parties.has(name)) parties.set(name, { full_name: name });
    }

    const accountNames = new Map<string, string>(); // name -> tally parent
    for (const r of receipts || []) {
      const acc = r.account as { account_name?: string; account_type?: string } | null;
      if (acc?.account_name) {
        accountNames.set(acc.account_name, acc.account_type === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts');
      }
    }

    const masters: string[] = [ledgerXml('Sales', 'Sales Accounts')];
    for (const p of Array.from(parties.values())) {
      const gst = p.gstin
        ? `\n    <PARTYGSTIN>${x(p.gstin)}</PARTYGSTIN>\n    <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>${p.gst_state_code ? `\n    <LEDSTATENAME>${x(GST_STATE_CODES[p.gst_state_code] || '')}</LEDSTATENAME>` : ''}`
        : '';
      masters.push(ledgerXml(p.full_name, 'Sundry Debtors', gst));
    }
    for (const [name, parent] of Array.from(accountNames.entries())) masters.push(ledgerXml(name, parent));

    // ── Sales vouchers (one per booking — the daybook) ──
    const vouchers: string[] = [];
    for (const b of bookings || []) {
      const payer = ((b.bill_to || b.client) as unknown as Party | null)?.full_name;
      const amount = Number(b.sell_price) || 0;
      if (!payer || amount <= 0) continue;
      const ref = b.trip_id || b.id;
      vouchers.push(`<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>${tallyDate(String(b.created_at))}</DATE>
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <VOUCHERNUMBER>${x(ref)}</VOUCHERNUMBER>
    <NARRATION>${x(`${ref} — ${b.title || ''}`)}</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${x(payer)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
      <BILLALLOCATIONS.LIST>
        <NAME>${x(ref)}</NAME>
        <BILLTYPE>New Ref</BILLTYPE>
        <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
      </BILLALLOCATIONS.LIST>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${amount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>
</TALLYMESSAGE>`);
    }

    // ── Receipt vouchers with bill-wise allocation ──
    for (const r of receipts || []) {
      const payer = (r.client as { full_name?: string } | null)?.full_name;
      const account = (r.account as { account_name?: string } | null)?.account_name;
      const amount = Number(r.amount) || 0;
      if (!payer || amount <= 0) continue;
      const allocs = (r.allocations || []) as Array<{ amount: number; booking: { trip_id?: string | null } | null }>;
      const allocated = allocs.reduce((s, a) => s + Number(a.amount), 0);
      const advance = Math.round((amount - allocated) * 100) / 100;
      const billAllocs = allocs
        .map((a) => `<BILLALLOCATIONS.LIST>
        <NAME>${x(a.booking?.trip_id || 'On Account')}</NAME>
        <BILLTYPE>Agst Ref</BILLTYPE>
        <AMOUNT>${Number(a.amount).toFixed(2)}</AMOUNT>
      </BILLALLOCATIONS.LIST>`)
        .concat(advance > 0 ? [`<BILLALLOCATIONS.LIST>
        <NAME>${x(`Advance ${r.receipt_number}`)}</NAME>
        <BILLTYPE>Advance</BILLTYPE>
        <AMOUNT>${advance.toFixed(2)}</AMOUNT>
      </BILLALLOCATIONS.LIST>`] : [])
        .join('\n      ');

      vouchers.push(`<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="Receipt" ACTION="Create">
    <DATE>${tallyDate(String(r.received_on))}</DATE>
    <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
    <VOUCHERNUMBER>${x(r.receipt_number)}</VOUCHERNUMBER>
    <NARRATION>${x(`${r.receipt_number}${r.reference ? ` / ${r.reference}` : ''}`)}</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${x(payer)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${amount.toFixed(2)}</AMOUNT>
      ${billAllocs}
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${x(account || 'Cash')}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>
</TALLYMESSAGE>`);
    }

    const xml = `<ENVELOPE>
<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
<BODY>
<IMPORTDATA>
<REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
<REQUESTDATA>
${masters.join('\n')}
${vouchers.join('\n')}
</REQUESTDATA>
</IMPORTDATA>
</BODY>
</ENVELOPE>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="tally-${from}-to-${to}.xml"`,
      },
    });
  } catch (err) {
    console.error('Tally export error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
