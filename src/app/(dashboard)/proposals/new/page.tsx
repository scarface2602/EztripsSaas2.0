'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Client, Supplier, ParsedQuote } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { FileText, Upload, Wand2, Loader2, AlertTriangle, Info, ArrowRight, Package, List, Plus, Trash2 } from 'lucide-react';
import type { TripCity } from '@/lib/types/database';
import { CURRENCY_OPTIONS } from '@/lib/utils/pricing';
import { SupplierSelect, ClientSelect } from '@/components/ui/inline-add-select';

type Step = 'quote-type' | 'choose' | 'import-setup' | 'parsing' | 'review' | 'manual' | 'trip-structure';

export default function NewProposalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<Step>('quote-type');
  const [quoteType, setQuoteType] = useState<'package' | 'itemised'>('itemised');
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedClient, setSelectedClient] = useState(searchParams.get('client_id') || '');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [pricingMode, setPricingMode] = useState<'standard' | 'tiered'>('standard');
  const [sourceTab, setSourceTab] = useState('text');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedQuote | null>(null);
  const [sanitisationFlags, setSanitisationFlags] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [travelStart, setTravelStart] = useState('');
  const [travelEnd, setTravelEnd] = useState('');
  const [paxAdults, setPaxAdults] = useState(2);
  const [paxChildren, setPaxChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [tripCities, setTripCities] = useState<TripCity[]>([]);
  const [prevStep, setPrevStep] = useState<'manual' | 'review'>('manual');

  useEffect(() => {
    async function fetch() {
      const [c, s] = await Promise.all([
        supabase.from('clients').select('*').order('full_name'),
        supabase.from('suppliers').select('*').order('name'),
      ]);
      setClients((c.data as Client[]) || []);
      setSuppliers((s.data as Supplier[]) || []);
    }
    fetch();
  }, [supabase]);

  function handleSupplierAdded(s: { id: string; name: string }) {
    setSuppliers(prev => [...prev, { id: s.id, name: s.name, created_by: null, type: null, country: null, contact_name: null, contact_email: null, contact_phone: null, payment_terms_days: null, notes: null, created_at: new Date().toISOString() } as Supplier]);
  }

  function handleClientAdded(c: { id: string; full_name: string }) {
    setClients(prev => [...prev, { id: c.id, full_name: c.full_name, created_by: null, phone: '', email: null, nationality: null, notes: null, created_at: new Date().toISOString() } as Client]);
  }

  async function handleParse() {
    setLoading(true);
    setStep('parsing');

    try {
      let text = rawText;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_type', file.name.endsWith('.pdf') ? 'pdf' : 'excel');

        const importRes = await fetch('/api/quotes/import', { method: 'POST', body: formData });
        const importData = await importRes.json();
        text = importData.text || '';
      }

      const parseRes = await fetch('/api/quotes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, supplier_id: selectedSupplier }),
      });
      const parseData = await parseRes.json();

      setParsedData(parseData.parsed);
      setSanitisationFlags(parseData.sanitisation_flags || []);

      // Identify missing fields
      const missing: string[] = [];
      const p = parseData.parsed as ParsedQuote;
      if (!p.destination) missing.push('destination');
      if (!p.travel_start) missing.push('travel_start');
      if (!p.travel_end) missing.push('travel_end');
      if (!p.pax_adults) missing.push('pax_adults');
      setMissingFields(missing);

      // Pre-fill form
      if (p.destination) setDestination(p.destination);
      if (p.travel_start) setTravelStart(p.travel_start);
      if (p.travel_end) setTravelEnd(p.travel_end);
      if (p.pax_adults) setPaxAdults(p.pax_adults);
      if (p.pax_children) setPaxChildren(p.pax_children);

      setStep('review');
    } catch {
      setStep('import-setup');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProposal() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const res = await fetch('/api/quotes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          created_by: user.id,
          client_id: selectedClient || null,
          supplier_id: selectedSupplier || null,
          pricing_mode: pricingMode,
          title: title || `Trip to ${destination}`,
          destination,
          travel_start: travelStart || null,
          travel_end: travelEnd || null,
          pax_adults: paxAdults,
          pax_children: paxChildren,
          children_ages: paxChildren > 0 && childrenAges.length > 0 ? childrenAges : null,
          currency,
          quote_type: quoteType,
          parsed_data: parsedData,
          trip_cities: tripCities.length > 0 ? tripCities : null,
        }),
      });
      const data = await res.json();
      if (data.id) router.push(`/proposals/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateManual() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('proposals').insert({
      created_by: user.id,
      client_id: selectedClient || null,
      pricing_mode: pricingMode,
      quote_type: quoteType,
      title: title || 'New Proposal',
      destination: destination || null,
      travel_start: travelStart || null,
      travel_end: travelEnd || null,
      pax_adults: paxAdults,
      pax_children: paxChildren,
      children_ages: paxChildren > 0 && childrenAges.length > 0 ? childrenAges : null,
      currency,
      status: 'draft',
      trip_cities: tripCities.length > 0 ? tripCities : null,
    }).select().single();

    if (data) {
      // Seed itinerary days from the date range so the itinerary tab is
      // populated immediately. Inclusive on both ends to match the convention
      // in /api/quotes/save: arrival day + nights + departure day.
      if (travelStart && travelEnd) {
        const start = new Date(travelStart);
        const end = new Date(travelEnd);
        if (end >= start) {
          // Build city lookup from trip_cities
          const cityForDayNum = (dayNum: number): string => {
            if (!tripCities.length) return '';
            let acc = 0;
            for (const c of tripCities) {
              acc += c.nights;
              if (dayNum <= acc) return c.city;
            }
            return tripCities[tripCities.length - 1].city;
          };
          const days = [];
          let dayNum = 1;
          const current = new Date(start);
          while (current <= end) {
            days.push({
              proposal_id: data.id,
              day_number: dayNum,
              date: current.toISOString().split('T')[0],
              city: cityForDayNum(dayNum) || undefined,
            });
            dayNum++;
            current.setDate(current.getDate() + 1);
          }
          if (days.length > 0) {
            await supabase.from('itinerary_days').insert(days);
          }
        }
      }
      router.push(`/proposals/${data.id}`);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">New Proposal</h1>

      {step === 'quote-type' && (
        <div className="space-y-4">
          <p className="text-muted-foreground">How is this trip priced?</p>
          <div className="grid grid-cols-2 gap-6">
            <Card
              className={`cursor-pointer hover:shadow-md transition-shadow ${quoteType === 'package' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setQuoteType('package')}
            >
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <Package className="h-12 w-12 mx-auto text-primary" />
                <CardTitle>Land Package</CardTitle>
                <CardDescription>DMC gives a single per-person rate covering hotels + transfers + sightseeing. You mark up the package price.</CardDescription>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer hover:shadow-md transition-shadow ${quoteType === 'itemised' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setQuoteType('itemised')}
            >
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <List className="h-12 w-12 mx-auto text-primary" />
                <CardTitle>Itemised</CardTitle>
                <CardDescription>Hotels booked separately with individual CP / SP rates per night. You control pricing per hotel.</CardDescription>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep('choose')}>
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 'choose' && (
        <div className="grid grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStep('import-setup')}>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <Wand2 className="h-12 w-12 mx-auto text-primary" />
              <CardTitle>Import Quote (AI-powered)</CardTitle>
              <CardDescription>Paste or upload a supplier quote. AI extracts all data automatically.</CardDescription>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStep('manual')}>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <CardTitle>Create Manually</CardTitle>
              <CardDescription>Start from scratch and fill in all details yourself.</CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'import-setup' && (
        <Card>
          <CardHeader><CardTitle>Import Quote</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <SupplierSelect
                  suppliers={suppliers}
                  value={selectedSupplier}
                  onChange={setSelectedSupplier}
                  onSupplierAdded={handleSupplierAdded}
                />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <ClientSelect
                  clients={clients}
                  value={selectedClient}
                  onChange={setSelectedClient}
                  onClientAdded={handleClientAdded}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pricing Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={pricingMode === 'standard'} onChange={() => setPricingMode('standard')} />
                  Standard
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={pricingMode === 'tiered'} onChange={() => setPricingMode('tiered')} />
                  Tiered
                </label>
              </div>
              <p className="text-xs text-amber-600">Cannot change pricing mode after creation</p>
            </div>

            <Separator />

            <Tabs value={sourceTab} onValueChange={setSourceTab}>
              <TabsList>
                <TabsTrigger value="text">Email / WhatsApp Text</TabsTrigger>
                <TabsTrigger value="file">PDF / Excel / CSV</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="space-y-2">
                <Textarea
                  placeholder="Paste supplier quote text here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={12}
                />
                <p className="text-xs text-muted-foreground text-right">{rawText.length} characters</p>
              </TabsContent>
              <TabsContent value="file" className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
                  <Input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="max-w-xs mx-auto" />
                  {file && <p className="text-sm mt-2 font-medium">{file.name}</p>}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('choose')}>Back</Button>
              <Button onClick={handleParse} disabled={!rawText && !file}>
                Parse with AI <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'parsing' && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <p className="text-lg font-medium">Parsing your quote with AI...</p>
            <p className="text-sm text-muted-foreground">This typically takes 10-30 seconds</p>
          </CardContent>
        </Card>
      )}

      {step === 'review' && parsedData && (
        <div className="space-y-4">
          {sanitisationFlags.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Sanitisation Warnings</p>
                <p className="text-sm text-yellow-700">The following fields contain potentially sensitive content: {sanitisationFlags.join(', ')}</p>
              </div>
            </div>
          )}

          {missingFields.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800">Missing Fields ({missingFields.length})</p>
                <p className="text-sm text-blue-700">Please fill in: {missingFields.join(', ')}</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Trip to ${destination}`} />
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} className={missingFields.includes('destination') ? 'border-red-500' : ''} />
              </div>
              <div className="space-y-2">
                <Label>Travel Start</Label>
                <Input type="date" value={travelStart} onChange={(e) => setTravelStart(e.target.value)} className={missingFields.includes('travel_start') ? 'border-red-500' : ''} />
              </div>
              <div className="space-y-2">
                <Label>Travel End</Label>
                <Input type="date" value={travelEnd} onChange={(e) => setTravelEnd(e.target.value)} className={missingFields.includes('travel_end') ? 'border-red-500' : ''} />
              </div>
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input type="number" min={1} value={paxAdults} onChange={(e) => setPaxAdults(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Children</Label>
                <Input type="number" min={0} value={paxChildren} onChange={(e) => { setPaxChildren(Number(e.target.value)); setChildrenAges([]); }} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCY_OPTIONS.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          {paxChildren > 0 && (
            <Card>
              <CardHeader><CardTitle>Children Ages</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-4 gap-3">
                {Array.from({ length: paxChildren }, (_, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Child {i + 1}</Label>
                    <Input
                      type="number" min={0} max={17} placeholder="Age"
                      value={childrenAges[i] ?? ''}
                      onChange={(e) => {
                        const ages = [...childrenAges];
                        ages[i] = e.target.value ? parseInt(e.target.value) : 0;
                        setChildrenAges(ages);
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {parsedData.hotels.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Hotels ({parsedData.hotels.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {parsedData.hotels.map((h, i) => (
                  <div key={i} className="p-3 border rounded-md">
                    <p className="font-medium">{h.name} — {h.city}</p>
                    <p className="text-sm text-muted-foreground">
                      {h.check_in || 'N/A'} to {h.check_out || 'N/A'} | {h.room_type || 'N/A'} | {h.meal_plan || 'N/A'}
                    </p>
                    {h.cp_per_night && <p className="text-sm">CP/night: {h.cp_per_night}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {parsedData.flights.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Flights ({parsedData.flights.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {parsedData.flights.map((f, i) => (
                  <div key={i} className="p-3 border rounded-md">
                    <p className="font-medium">{f.flight_number}</p>
                    {f.cp_total && <p className="text-sm">CP Total: {f.cp_total}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(parsedData.inclusions.length > 0 || parsedData.exclusions.length > 0) && (
            <Card>
              <CardHeader><CardTitle>Inclusions / Exclusions</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-sm mb-2">Included</p>
                  {parsedData.inclusions.map((inc, i) => (
                    <p key={i} className="text-sm text-green-700">+ {inc}</p>
                  ))}
                </div>
                <div>
                  <p className="font-medium text-sm mb-2">Excluded</p>
                  {parsedData.exclusions.map((exc, i) => (
                    <p key={i} className="text-sm text-red-700">- {exc}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('import-setup')}>Back</Button>
            <Button onClick={handleCreateProposal} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Proposal <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 'trip-structure' && (() => {
        const start = travelStart ? new Date(travelStart) : null;
        const end = travelEnd ? new Date(travelEnd) : null;
        const tripNights = start && end ? Math.round((end.getTime() - start.getTime()) / 86400000) : 0;
        const cityNightsTotal = tripCities.reduce((s, c) => s + (c.nights || 0), 0);
        const mismatch = tripCities.length > 0 && tripNights > 0 && cityNightsTotal !== tripNights;

        function addCity() { setTripCities([...tripCities, { city: '', nights: 1, check_in: '', check_out: '' }]); }
        function removeCity(i: number) { setTripCities(tripCities.filter((_, idx) => idx !== i)); }
        function updateCity(i: number, updates: Partial<TripCity>) {
          const updated = [...tripCities];
          updated[i] = { ...updated[i], ...updates };
          setTripCities(updated);
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle>Trip Structure</CardTitle>
              <CardDescription>How many cities and how many nights in each? (Optional — can be set later)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tripNights > 0 && (
                <p className="text-sm text-muted-foreground">
                  Trip total: {tripNights} night{tripNights !== 1 ? 's' : ''}
                  {tripCities.length > 0 && ` | Allocated: ${cityNightsTotal} night${cityNightsTotal !== 1 ? 's' : ''}`}
                </p>
              )}
              {mismatch && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded flex items-center gap-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  City nights ({cityNightsTotal}) don&apos;t match trip nights ({tripNights})
                </div>
              )}
              {tripCities.map((c, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">City {i + 1}</Label>
                    <Input value={c.city} onChange={(e) => updateCity(i, { city: e.target.value })} placeholder="City name" />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Nights</Label>
                    <Input type="number" min={1} value={c.nights} onChange={(e) => updateCity(i, { nights: Number(e.target.value) })} />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeCity(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addCity}>
                <Plus className="h-4 w-4 mr-1" /> Add City
              </Button>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(prevStep)}>Back</Button>
                <Button
                  onClick={prevStep === 'review' ? handleCreateProposal : handleCreateManual}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Create Proposal
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {step === 'manual' && (
        <Card>
          <CardHeader><CardTitle>Create Proposal Manually</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <ClientSelect
                  clients={clients}
                  value={selectedClient}
                  onChange={setSelectedClient}
                  onClientAdded={handleClientAdded}
                />
              </div>
              <div className="space-y-2">
                <Label>Pricing Mode</Label>
                <div className="flex gap-4 h-10 items-center">
                  <label className="flex items-center gap-2"><input type="radio" checked={pricingMode === 'standard'} onChange={() => setPricingMode('standard')} /> Standard</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={pricingMode === 'tiered'} onChange={() => setPricingMode('tiered')} /> Tiered</label>
                </div>
              </div>
              <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trip to..." /></div>
              <div className="space-y-2"><Label>Destination</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
              <div className="space-y-2"><Label>Travel Start</Label><Input type="date" value={travelStart} onChange={(e) => setTravelStart(e.target.value)} /></div>
              <div className="space-y-2"><Label>Travel End</Label><Input type="date" value={travelEnd} onChange={(e) => setTravelEnd(e.target.value)} /></div>
              <div className="space-y-2"><Label>Adults</Label><Input type="number" min={1} value={paxAdults} onChange={(e) => setPaxAdults(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Children</Label><Input type="number" min={0} value={paxChildren} onChange={(e) => { setPaxChildren(Number(e.target.value)); setChildrenAges([]); }} /></div>
              <div className="col-span-2 space-y-2">
                <Label>Currency</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCY_OPTIONS.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                </select>
              </div>
            </div>
            {paxChildren > 0 && (
              <div className="space-y-2">
                <Label>Children Ages</Label>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: paxChildren }, (_, i) => (
                    <div key={i} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Child {i + 1}</Label>
                      <Input
                        type="number" min={0} max={17} placeholder="Age"
                        value={childrenAges[i] ?? ''}
                        onChange={(e) => {
                          const ages = [...childrenAges];
                          ages[i] = e.target.value ? parseInt(e.target.value) : 0;
                          setChildrenAges(ages);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('choose')}>Back</Button>
              <Button onClick={() => { setPrevStep('manual'); setStep('trip-structure'); }}>
                Next: Trip Structure <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
