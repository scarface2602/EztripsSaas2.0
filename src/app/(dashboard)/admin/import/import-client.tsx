'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle, Users, Truck, Package } from 'lucide-react';
import { toast } from 'sonner';

type Entity = 'clients' | 'suppliers' | 'packages';

const ENTITIES: {
  value: Entity;
  label: string;
  icon: typeof Users;
  columns: { key: string; label: string; required?: boolean; hint?: string }[];
  example: Record<string, string | number>;
}[] = [
  {
    value: 'clients',
    label: 'Customers',
    icon: Users,
    columns: [
      { key: 'full_name', label: 'Full Name', required: true },
      { key: 'phone', label: 'Phone', required: true, hint: 'used to skip duplicates' },
      { key: 'email', label: 'Email' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'notes', label: 'Notes' },
    ],
    example: { full_name: 'Rahul Sharma', phone: '+919876543210', email: 'rahul@example.com', nationality: 'Indian', notes: 'Repeat client' },
  },
  {
    value: 'suppliers',
    label: 'Suppliers',
    icon: Truck,
    columns: [
      { key: 'name', label: 'Name', required: true, hint: 'used to skip duplicates' },
      { key: 'type', label: 'Type', hint: 'DMC / hotel / airline / car / activity / other' },
      { key: 'country', label: 'Country' },
      { key: 'contact_name', label: 'Contact Name' },
      { key: 'contact_email', label: 'Contact Email' },
      { key: 'contact_phone', label: 'Contact Phone' },
      { key: 'payment_terms_days', label: 'Payment Terms (days)' },
      { key: 'notes', label: 'Notes' },
    ],
    example: { name: 'Bali Sunrise DMC', type: 'DMC', country: 'Indonesia', contact_name: 'Made', contact_email: 'ops@balisunrise.id', contact_phone: '+62811222333', payment_terms_days: 15, notes: '' },
  },
  {
    value: 'packages',
    label: 'Website Packages',
    icon: Package,
    columns: [
      { key: 'title', label: 'Title', required: true },
      { key: 'slug', label: 'Slug', hint: 'auto-generated from title if blank; used to skip duplicates' },
      { key: 'destination', label: 'Destination' },
      { key: 'nights', label: 'Nights' },
      { key: 'price_3star', label: 'Price 3★' },
      { key: 'price_4star', label: 'Price 4★' },
      { key: 'price_5star', label: 'Price 5★' },
      { key: 'highlights', label: 'Highlights', hint: 'separate with ; or |' },
      { key: 'inclusions', label: 'Inclusions', hint: 'separate with ; or |' },
      { key: 'exclusions', label: 'Exclusions', hint: 'separate with ; or |' },
      { key: 'cover_image', label: 'Cover Image URL' },
      { key: 'terms', label: 'Terms' },
    ],
    example: { title: 'Bali 5N Honeymoon', slug: '', destination: 'Bali', nights: 5, price_3star: 45000, price_4star: 58000, price_5star: 75000, highlights: 'Ubud tour; Nusa Penida day trip', inclusions: 'Breakfast; Transfers', exclusions: 'Flights; Visa', cover_image: '', terms: '' },
  },
];

interface ImportOutcome {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export default function ImportClient() {
  const [entity, setEntity] = useState<Entity>('clients');
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = ENTITIES.find(e => e.value === entity)!;

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([meta.example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, meta.label);
    XLSX.writeFile(wb, `eztrips-${entity}-template.xlsx`);
  }

  function handleFile(file: File) {
    setOutcome(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Normalize headers: trim, lowercase, spaces→underscores so
        // "Full Name", "full name" and "full_name" all match.
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        const rows = raw.map(r => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(r)) {
            out[k.trim().toLowerCase().replace(/\s+/g, '_').replace(/[()★]/g, '')] = v;
          }
          return out;
        });
        if (rows.length === 0) {
          toast.error('No rows found in the file');
          return;
        }
        setParsedRows(rows);
        setFileName(file.name);
        toast.success(`${rows.length} rows parsed — review and import`);
      } catch {
        toast.error('Could not read that file — make sure it is .xlsx, .xls or .csv');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function runImport() {
    setImporting(true);
    setOutcome(null);
    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setOutcome(data);
      if (data.inserted > 0) toast.success(`Imported ${data.inserted} ${meta.label.toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const previewCols = meta.columns.map(c => c.key);

  return (
    <div className="space-y-4">
      {/* Entity selector */}
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        {ENTITIES.map(e => {
          const Icon = e.icon;
          const active = entity === e.value;
          return (
            <button
              key={e.value}
              onClick={() => { setEntity(e.value); setParsedRows([]); setFileName(''); setOutcome(null); }}
              className={`rounded-lg border p-4 text-left transition-colors ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
            >
              <Icon className={`h-5 w-5 mb-2 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="font-medium text-sm">{e.label}</p>
            </button>
          );
        })}
      </div>

      {/* Expected columns + template */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Expected columns</CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" /> Download template
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {meta.columns.map(c => (
              <Badge key={c.key} variant={c.required ? 'default' : 'outline'} className="text-xs" title={c.hint}>
                {c.label}{c.required ? ' *' : ''}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            * required · column names are matched case-insensitively · duplicates are skipped automatically
            {entity === 'packages' && ' · imported packages arrive unpublished — review them in Website CMS before publishing'}
          </p>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardContent className="py-6">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium text-sm">{fileName || 'Drop your Excel/CSV file here, or click to choose'}</p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls or .csv — up to 2000 rows</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview + import */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Preview — {parsedRows.length} rows</CardTitle>
            <Button onClick={runImport} disabled={importing} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {parsedRows.length} {meta.label.toLowerCase()}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    {previewCols.map(c => <TableHead key={c} className="text-xs whitespace-nowrap">{c}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 25).map((r, i) => (
                    <TableRow key={i}>
                      {previewCols.map(c => (
                        <TableCell key={c} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                          {r[c] == null || r[c] === '' ? '—' : String(r[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedRows.length > 25 && (
              <p className="text-xs text-muted-foreground px-4 py-2 border-t">…and {parsedRows.length - 25} more rows</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outcome */}
      {outcome && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {outcome.inserted} imported
              </span>
              <span className="text-muted-foreground">{outcome.skipped} skipped (duplicates)</span>
              {outcome.errors.length > 0 && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <AlertTriangle className="h-4 w-4" /> {outcome.errors.length} errors
                </span>
              )}
            </div>
            {outcome.errors.length > 0 && (
              <div className="text-xs text-red-600 space-y-0.5 max-h-32 overflow-y-auto">
                {outcome.errors.slice(0, 20).map((e, i) => (
                  <p key={i}>Row {e.row}: {e.message}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
