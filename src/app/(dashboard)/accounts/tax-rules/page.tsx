'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Landmark, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { gstinError, gstinStateCode, GST_STATE_CODES, normalizeGstin } from '@/lib/utils/gstin';

interface TaxConfigShape {
  air_agent_method: 'MARGIN' | 'BASIC_FARE';
  cab_fuel_included: boolean;
  tour_operator_rate: number;
  margin_rate: number;
  cab_gross_rate: number;
  rule32_domestic_pct: number;
  rule32_international_pct: number;
  tcs: { mode: 'FLAT' | 'SLAB'; flat_rate: number; threshold: number; rate_below: number; rate_above: number };
}

// Master tax rules — per organisation, so every agency on the platform
// carries its own GST identity and rates. Defaults match current law;
// when the law changes, change it here, not in code.
export default function TaxRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [gstin, setGstin] = useState('');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [cfg, setCfg] = useState<TaxConfigShape | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/settings/tax');
    if (res.ok) {
      const data = await res.json();
      setOrgName(data.name || '');
      setGstin(data.gstin || '');
      setLegalName(data.gst_legal_name || '');
      setAddress(data.address || '');
      setCfg(data.resolved_tax_config);
    } else {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error || 'Failed to load tax settings');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const gstinValue = normalizeGstin(gstin);
  const gstinProblem = gstinValue ? gstinError(gstinValue) : null;
  const stateName = gstinValue && !gstinProblem ? GST_STATE_CODES[gstinStateCode(gstinValue) || ''] : null;

  async function save() {
    if (!cfg || saving) return;
    if (gstinValue && gstinProblem) { toast.error(gstinProblem); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/tax', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin: gstinValue, gst_legal_name: legalName, address, tax_config: cfg }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to save');
      }
      toast.success('Tax rules saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => (v === '' ? 0 : Number(v));

  if (loading || !cfg) {
    return <div className="py-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Tax Rules</h1>
          <Badge variant="outline">{orgName}</Badge>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">GST identity</CardTitle>
          <CardDescription>Printed on tax invoices and used to split CGST/SGST vs IGST.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>GSTIN</Label>
            <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="20AAJFE4090P1Z8" className="font-mono" />
            {gstinValue && gstinProblem && <p className="text-xs text-red-600">{gstinProblem}</p>}
            {stateName && <p className="text-xs text-green-700">Valid · {stateName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Legal name (as per GST)</Label>
            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="EZTRIPS" />
          </div>
          <div className="space-y-1.5 col-span-full">
            <Label>Registered address</Label>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">GST rates & methods</CardTitle>
          <CardDescription>Defaults follow current law. Override per invoice when needed.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Tour operator rate (% on gross, no ITC)</Label>
            <Input type="number" value={cfg.tour_operator_rate} onChange={(e) => setCfg({ ...cfg, tour_operator_rate: num(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Margin / service-fee rate (%)</Label>
            <Input type="number" value={cfg.margin_rate} onChange={(e) => setCfg({ ...cfg, margin_rate: num(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Air agent valuation</Label>
            <Select value={cfg.air_agent_method} onValueChange={(v) => v && setCfg({ ...cfg, air_agent_method: v as 'MARGIN' | 'BASIC_FARE' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MARGIN">Margin (sell − cost)</SelectItem>
                <SelectItem value="BASIC_FARE">Rule 32(3) — % of basic fare</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Rule 32(3) domestic %</Label>
              <Input type="number" value={cfg.rule32_domestic_pct} onChange={(e) => setCfg({ ...cfg, rule32_domestic_pct: num(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>International %</Label>
              <Input type="number" value={cfg.rule32_international_pct} onChange={(e) => setCfg({ ...cfg, rule32_international_pct: num(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center justify-between border rounded-md px-3 py-2 col-span-full">
            <div>
              <Label>Cab/transfer with fuel included</Label>
              <p className="text-xs text-muted-foreground">On: {cfg.cab_gross_rate}% on gross, ITC blocked. Off: {cfg.margin_rate}% on margin.</p>
            </div>
            <Switch checked={cfg.cab_fuel_included} onCheckedChange={(c) => setCfg({ ...cfg, cab_fuel_included: c })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">TCS — overseas tour packages</CardTitle>
          <CardDescription>Current law (from 01-04-2026): flat 2%, no threshold. SLAB mode keeps the old 5%/20% tiers.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={cfg.tcs.mode} onValueChange={(v) => v && setCfg({ ...cfg, tcs: { ...cfg.tcs, mode: v as 'FLAT' | 'SLAB' } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FLAT">Flat</SelectItem>
                <SelectItem value="SLAB">Slab</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {cfg.tcs.mode === 'FLAT' ? (
            <div className="space-y-1.5">
              <Label>Flat rate %</Label>
              <Input type="number" value={cfg.tcs.flat_rate} onChange={(e) => setCfg({ ...cfg, tcs: { ...cfg.tcs, flat_rate: num(e.target.value) } })} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Threshold (₹)</Label>
                <Input type="number" value={cfg.tcs.threshold} onChange={(e) => setCfg({ ...cfg, tcs: { ...cfg.tcs, threshold: num(e.target.value) } })} />
              </div>
              <div className="space-y-1.5">
                <Label>Below %</Label>
                <Input type="number" value={cfg.tcs.rate_below} onChange={(e) => setCfg({ ...cfg, tcs: { ...cfg.tcs, rate_below: num(e.target.value) } })} />
              </div>
              <div className="space-y-1.5">
                <Label>Above %</Label>
                <Input type="number" value={cfg.tcs.rate_above} onChange={(e) => setCfg({ ...cfg, tcs: { ...cfg.tcs, rate_above: num(e.target.value) } })} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
