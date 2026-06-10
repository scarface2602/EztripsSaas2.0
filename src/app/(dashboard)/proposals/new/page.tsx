'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { createClient } from '@/lib/supabase/client';
import type { Client, ParsedQuote, TripCity } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Upload, Wand2, Loader2, AlertTriangle, Info, ArrowRight, Mail, Route } from 'lucide-react';
import { RouteSuggestions } from '@/components/proposals/route-suggestions';
import { CURRENCY_OPTIONS } from '@/lib/utils/pricing';

type Step = 'choose' | 'suggestions' | 'import-setup' | 'parsing' | 'review';

export default function NewProposalPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-8 text-center text-muted-foreground">Loading...</div>}>
      <NewProposalContent />
    </Suspense>
  );
}

function NewProposalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const enquiryId = searchParams.get('enquiry_id') || '';

  const [step, setStep] = useState<Step>('choose');
  const [, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState(searchParams.get('client_id') || '');
  const [sourceTab, setSourceTab] = useState('text');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedQuote | null>(null);
  const [sanitisationFlags, setSanitisationFlags] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [originalEnquiry, setOriginalEnquiry] = useState<{ destination?: string; adults?: number; children?: number; travel_date?: string; number_of_nights?: number } | null>(null);
  const [discrepancies, setDiscrepancies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [travelStart, setTravelStart] = useState('');
  const [travelEnd, setTravelEnd] = useState('');
  const [paxAdults, setPaxAdults] = useState(2);
  const [paxChildren, setPaxChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [numNights, setNumNights] = useState<number | ''>('');
  const [numRooms, setNumRooms] = useState<number | ''>(1);
  const [tripCities, setTripCities] = useState<TripCity[]>([]);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryTripId, setEnquiryTripId] = useState('');
  const [parseError, setParseError] = useState('');

  // Auto-calculate nights from dates
  useEffect(() => {
    if (travelStart && travelEnd) {
      const diff = Math.round((new Date(travelEnd).getTime() - new Date(travelStart).getTime()) / 86400000);
      if (diff >= 0) setNumNights(diff);
    }
  }, [travelStart, travelEnd]);

  function handleTravelStartChange(val: string) {
    setTravelStart(val);
    if (val && numNights && typeof numNights === 'number' && numNights > 0) {
      const d = new Date(val);
      d.setDate(d.getDate() + numNights);
      setTravelEnd(d.toISOString().split('T')[0]);
    }
  }

  function handleTravelEndChange(val: string) {
    setTravelEnd(val);
  }

  function handleNumNightsChange(val: number | '') {
    setNumNights(val);
    if (travelStart && typeof val === 'number' && val >= 0) {
      const d = new Date(travelStart);
      d.setDate(d.getDate() + val);
      setTravelEnd(d.toISOString().split('T')[0]);
    }
  }

  useEffect(() => {
    async function fetchData() {
      const [c] = await Promise.all([
        supabase.from('clients').select('*').order('full_name'),
      ]);
      setClients((c.data as Client[]) || []);

      // If coming from an enquiry, fetch enquiry data to pre-fill the form
      if (enquiryId) {
        const { data: enq } = await supabase
          .from('website_enquiries')
          .select('*')
          .eq('id', enquiryId)
          .single();

        if (enq) {
          setOriginalEnquiry(enq);
          setEnquiryName(enq.name || '');
          if (enq.trip_id) setEnquiryTripId(enq.trip_id);
          if (enq.destination) {
            setDestination(enq.destination);
            setTitle(`Trip to ${enq.destination}`);
          }
          if (enq.travel_date) setTravelStart(enq.travel_date);
          if (enq.travel_date && enq.number_of_nights) {
            const start = new Date(enq.travel_date);
            start.setDate(start.getDate() + enq.number_of_nights);
            setTravelEnd(start.toISOString().split('T')[0]);
          }
          if (enq.adults) setPaxAdults(enq.adults);
          if (enq.children) setPaxChildren(enq.children);
          if (enq.children_ages) {
            const ages = String(enq.children_ages).split(',').map(Number).filter(n => !isNaN(n));
            if (ages.length > 0) setChildrenAges(ages);
          }
          // Parse cities from requirement_details and pre-populate trip structure
          const reqDetails = enq.requirement_details as Record<string, unknown> | null;
          const cities = (reqDetails?.cities as string[]) || [];
          if (cities.length > 0) {
            const totalNights = enq.number_of_nights || 0;
            // Distribute nights across cities: equal split with remainder to first city
            const baseNights = totalNights > 0 ? Math.floor(totalNights / cities.length) : 1;
            const remainder = totalNights > 0 ? totalNights % cities.length : 0;
            const structure: TripCity[] = cities.map((city, i) => ({
              city,
              nights: baseNights + (i < remainder ? 1 : 0),
              check_in: '',
              check_out: '',
            }));
            setTripCities(structure);
          }

          if (enq.client_id) {
            setSelectedClient(enq.client_id);
          } else {
            // Try to match existing client by name or phone
            const clientsList = (c.data as Client[]) || [];
            const matched = clientsList.find(cl =>
              cl.full_name?.toLowerCase() === (enq.name || '').toLowerCase() ||
              (enq.phone && cl.phone && cl.phone.replace(/\D/g, '') === (enq.phone || '').replace(/\D/g, ''))
            );
            if (matched) {
              setSelectedClient(matched.id);
            } else if (enq.name) {
              // Auto-create client from enquiry data
              const { data: newClient } = await supabase
                .from('clients')
                .insert({ full_name: enq.name, phone: enq.phone || null, email: enq.email || null })
                .select()
                .single();
              if (newClient) {
                setClients(prev => [...prev, newClient as Client]);
                setSelectedClient(newClient.id);
                await supabase.from('website_enquiries').update({ client_id: newClient.id }).eq('id', enquiryId);
              }
            }
          }
        }
      }
    }
    fetchData();
  }, [supabase, enquiryId]);

  async function handleParse() {
    setLoading(true);
    setParseError('');
    setStep('parsing');

    try {
      let text = rawText;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_type', file.name.endsWith('.pdf') ? 'pdf' : 'excel');

        const importRes = await fetch('/api/quotes/import', { method: 'POST', body: formData });
        const importCt = importRes.headers.get('content-type') || '';
        if (!importCt.includes('application/json')) {
          throw new Error(`File import returned ${importRes.status} — not JSON. You may need to re-login.`);
        }
        const importData = await importRes.json();
        if (!importRes.ok) throw new Error(importData.error || 'Failed to import file');
        text = importData.text || '';
        if (!text.trim()) throw new Error('No text could be extracted from the file');
      }

      if (!text.trim()) throw new Error('No text to parse');

      const parseRes = await fetch('/api/quotes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const contentType = parseRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned ${parseRes.status} (${parseRes.statusText}) — not JSON. You may need to re-login.`);
      }
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'AI parsing failed');
      if (!parseData.parsed) throw new Error('AI returned empty result');

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

      // Check for discrepancies against original enquiry
      const newDiscrepancies: string[] = [];
      if (originalEnquiry) {
        if (originalEnquiry.destination && p.destination && !p.destination.toLowerCase().includes(originalEnquiry.destination.toLowerCase()) && !originalEnquiry.destination.toLowerCase().includes(p.destination.toLowerCase())) {
          newDiscrepancies.push(`Destination (Enquiry: ${originalEnquiry.destination}, Quote: ${p.destination})`);
        }
        const eqAdults = Number(originalEnquiry.adults || 0);
        const qAdults = Number(p.pax_adults || 0);
        if (originalEnquiry.adults && p.pax_adults && eqAdults !== qAdults) {
          newDiscrepancies.push(`Adults (Enquiry: ${eqAdults}, Quote: ${qAdults})`);
        }
        
        const eqChildren = Number(originalEnquiry.children || 0);
        const qChildren = Number(p.pax_children || 0);
        if (originalEnquiry.children !== undefined && originalEnquiry.children !== null && eqChildren !== qChildren) {
          newDiscrepancies.push(`Children (Enquiry: ${eqChildren}, Quote: ${qChildren})`);
        }
        if (originalEnquiry.travel_date && p.travel_start && originalEnquiry.travel_date !== p.travel_start) {
          newDiscrepancies.push(`Travel Start (Enquiry: ${originalEnquiry.travel_date}, Quote: ${p.travel_start})`);
        }
        if (originalEnquiry.number_of_nights && p.travel_start && p.travel_end) {
          const parsedNights = Math.round((new Date(p.travel_end).getTime() - new Date(p.travel_start).getTime()) / 86400000);
          if (originalEnquiry.number_of_nights !== parsedNights) {
            newDiscrepancies.push(`Nights (Enquiry: ${originalEnquiry.number_of_nights}, Quote: ${parsedNights})`);
          }
        }
      }
      setDiscrepancies(newDiscrepancies);

      // Pre-fill form
      if (p.destination) setDestination(p.destination);
      if (p.travel_start) setTravelStart(p.travel_start);
      if (p.travel_end) setTravelEnd(p.travel_end);
      if (p.pax_adults) setPaxAdults(p.pax_adults);
      if (p.pax_children) setPaxChildren(p.pax_children);

      setStep('review');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Parsing failed';
      setParseError(msg);
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
          supplier_id: null,
          pricing_mode: 'standard',
          title: title || `Trip to ${destination}`,
          destination,
          travel_start: travelStart || null,
          travel_end: travelEnd || null,
          pax_adults: paxAdults,
          pax_children: paxChildren,
          children_ages: paxChildren > 0 && childrenAges.length > 0 ? childrenAges : null,
          currency,
          num_nights: typeof numNights === 'number' ? numNights : null,
          num_rooms: typeof numRooms === 'number' ? numRooms : null,
          extra_beds: null,
          quote_type: 'itemised',
          parsed_data: parsedData,
          trip_cities: tripCities.length > 0 ? tripCities : null,
          enquiry_id: enquiryId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert('Error saving proposal: ' + (data.error || 'Unknown error') + (data.stack ? '\n\n' + data.stack : ''));
        return;
      }
      if (data.id) {
        if (enquiryId) {
          await fetch('/api/website/cms/enquiries', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: enquiryId, status: 'in_progress' }),
          });
        }
        router.push(`/proposals/${data.id}`);
      }
    } catch (e) {
      alert('Network or unexpected error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateManual() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    try {
      const { data, error } = await supabase.from('proposals').insert({
        created_by: user.id,
        client_id: selectedClient || null,
        enquiry_id: enquiryId || null,
        pricing_mode: 'standard',
        quote_type: 'itemised',
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
        trip_id: enquiryTripId || null,
      }).select().single();

      if (error) {
        console.error('Proposal creation failed:', error);
        setLoading(false);
        return;
      }

    if (data) {
      if (enquiryId) {
        await fetch('/api/website/cms/enquiries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: enquiryId, status: 'in_progress' }),
        });
      }

      if (travelStart && travelEnd) {
        const start = new Date(travelStart);
        const end = new Date(travelEnd);
        if (end >= start) {
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs items={[
        { label: 'Proposals', href: '/proposals' },
        { label: 'New Proposal' },
      ]} />
      <h1 className="text-2xl font-bold">New Proposal</h1>

      {enquiryId && enquiryName && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
          <Mail className="h-4 w-4 text-blue-600" />
          <span className="text-blue-800">
            Creating from enquiry by <span className="font-medium">{enquiryName}</span>
            {destination && <> for <span className="font-medium">{destination}</span></>}
          </span>
          <button
            className="ml-auto text-blue-600 hover:underline text-xs"
            onClick={() => router.push(`/admin/website/enquiries/${enquiryId}`)}
          >
            View enquiry
          </button>
        </div>
      )}

      {step === 'choose' && (
        <div className={`grid grid-cols-1 gap-6 ${enquiryId && destination ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStep('import-setup')}>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <Wand2 className="h-12 w-12 mx-auto text-primary" />
              <CardTitle>Import Quote (AI-powered)</CardTitle>
              <CardDescription>Paste or upload a supplier quote. AI extracts all data automatically.</CardDescription>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleCreateManual}>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              {loading ? <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" /> : <FileText className="h-12 w-12 mx-auto text-muted-foreground" />}
              <CardTitle>Create Manually</CardTitle>
              <CardDescription>Start from scratch and fill in all details yourself.</CardDescription>
            </CardContent>
          </Card>
          {enquiryId && destination && (
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/30" onClick={() => setStep('suggestions')}>
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <Route className="h-12 w-12 mx-auto text-primary" />
                <CardTitle>Use Past Route</CardTitle>
                <CardDescription>Clone a proven route configuration from a past proposal for {destination}.</CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === 'suggestions' && (
        <RouteSuggestions
          destination={destination}
          cities={tripCities.map(tc => tc.city)}
          duration={numNights}
          enquiryId={enquiryId}
          clientId={selectedClient}
          travelStart={travelStart}
          travelEnd={travelEnd}
          paxAdults={paxAdults}
          paxChildren={paxChildren}
          childrenAges={childrenAges}
          title={title || `Trip to ${destination}`}
          currency={currency}
          tripCities={tripCities}
          onBack={() => setStep('choose')}
        />
      )}

      {step === 'import-setup' && (
        <Card>
          <CardHeader><CardTitle>Import Quote</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {parseError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{parseError}</p>
              </div>
            )}

            <div className="space-y-4">
              <Label>Quote Source</Label>
              <div className="space-y-4">
                <div className="flex bg-muted rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setSourceTab('text')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${sourceTab === 'text' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Email / WhatsApp Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceTab('file')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${sourceTab === 'file' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    PDF / Excel / CSV
                  </button>
                </div>
                {sourceTab === 'text' && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Paste supplier quote text here..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={12}
                    />
                    <p className="text-xs text-muted-foreground text-right">{rawText.length} characters</p>
                  </div>
                )}
                {sourceTab === 'file' && (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
                    <Input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="max-w-xs mx-auto" />
                    {file && <p className="text-sm mt-2 font-medium">{file.name}</p>}
                  </div>
                )}
              </div>
            </div>

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
                <p className="font-medium text-yellow-800">Sensitive Fields Removed</p>
                <p className="text-sm text-yellow-700">We stripped these supplier-only fields: {sanitisationFlags.join(', ')}.</p>
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

          {discrepancies.length > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-md flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Quote Discrepancies</p>
                <p className="text-sm text-orange-700">The parsed quote differs from the original enquiry:</p>
                <ul className="list-disc list-inside text-sm text-orange-700 mt-1 mb-2 space-y-1">
                  {discrepancies.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
                <p className="text-sm text-orange-700 font-medium">Please review and confirm the details below before creating the proposal.</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input type="date" value={travelStart} onChange={(e) => handleTravelStartChange(e.target.value)} className={missingFields.includes('travel_start') ? 'border-red-500' : ''} />
              </div>
              <div className="space-y-2">
                <Label>No. of Nights</Label>
                <Input type="number" min={0} value={numNights} onChange={(e) => handleNumNightsChange(e.target.value ? Number(e.target.value) : '')} placeholder="Auto-calculated" />
              </div>
              <div className="space-y-2">
                <Label>Travel End</Label>
                <Input type="date" value={travelEnd} onChange={(e) => handleTravelEndChange(e.target.value)} className={missingFields.includes('travel_end') ? 'border-red-500' : ''} />
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
                <Label>No. of Rooms</Label>
                <Input type="number" min={1} value={numRooms} onChange={(e) => setNumRooms(e.target.value ? Number(e.target.value) : '')} placeholder="1" />
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
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(parsedData.inclusions.length > 0 || parsedData.exclusions.length > 0) && (
            <Card>
              <CardHeader><CardTitle>Inclusions / Exclusions</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

    </div>
  );
}
