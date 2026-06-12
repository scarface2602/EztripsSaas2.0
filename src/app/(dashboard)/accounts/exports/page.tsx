'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, FileCode2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// Accounts → out: GSTR-1 for the CA, Tally XML for the books.
export default function ExportsPage() {
  const lastMonth = subMonths(new Date(), 1);
  const [gstrMonth, setGstrMonth] = useState(format(lastMonth, 'yyyy-MM'));
  const [tallyFrom, setTallyFrom] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [tallyTo, setTallyTo] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Download className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Exports</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> GSTR-1 (CSV)
          </CardTitle>
          <CardDescription>
            B2B tax invoices by GSTIN, B2C summarised by rate and place of supply,
            credit notes referencing originals. Hand it to your CA for filing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Input type="month" value={gstrMonth} onChange={(e) => setGstrMonth(e.target.value)} />
          </div>
          <Button disabled={!gstrMonth} onClick={() => { window.location.href = `/api/exports/gstr1?month=${gstrMonth}`; }}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode2 className="h-4 w-4" /> Tally Prime (XML)
          </CardTitle>
          <CardDescription>
            Ledger masters (billing entities with GSTIN, payment accounts), Sales
            vouchers per booking, Receipt vouchers with bill-wise allocation.
            Import in Tally: Gateway → Import Data → XML.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={tallyFrom} onChange={(e) => setTallyFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={tallyTo} onChange={(e) => setTallyTo(e.target.value)} />
          </div>
          <Button disabled={!tallyFrom || !tallyTo} onClick={() => { window.location.href = `/api/exports/tally?from=${tallyFrom}&to=${tallyTo}`; }}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Re-importing the same period into Tally can duplicate vouchers — import each period once,
        or delete the period in Tally first.
      </p>
    </div>
  );
}
