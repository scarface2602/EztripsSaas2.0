'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ClientSelect } from '@/components/ui/inline-add-select';

export default function NewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proposalId = searchParams.get('proposal_id');
  const supabase = useMemo(() => createClient(), []);

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProposal, setLoadingProposal] = useState(!!proposalId);

  // Form fields
  const [selectedClient, setSelectedClient] = useState('');
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [travelStart, setTravelStart] = useState('');
  const [travelEnd, setTravelEnd] = useState('');
  const [paxAdults, setPaxAdults] = useState(2);
  const [paxChildren, setPaxChildren] = useState(0);
  const [totalSellPrice, setTotalSellPrice] = useState(0);
  const [totalCostPrice, setTotalCostPrice] = useState(0);
  const [currency, setCurrency] = useState('INR');
  const [specialRequests, setSpecialRequests] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('clients').select('*').order('full_name');
      setClients((data as Client[]) || []);

      if (proposalId) {
        const { data: proposal } = await supabase
          .from('proposals')
          .select('*')
          .eq('id', proposalId)
          .single();

        if (proposal) {
          setTitle(proposal.title || '');
          setDestination(proposal.destination || '');
          setTravelStart(proposal.travel_start || '');
          setTravelEnd(proposal.travel_end || '');
          setPaxAdults(proposal.pax_adults || 2);
          setPaxChildren(proposal.pax_children || 0);
          setSelectedClient(proposal.client_id || '');
          setTotalSellPrice(proposal.total_sp || 0);
          setCurrency(proposal.currency || 'INR');
        }
        setLoadingProposal(false);
      }
    }
    init();
  }, [supabase, proposalId]);

  function handleClientAdded(c: { id: string; full_name: string }) {
    setClients(prev => [...prev, { id: c.id, full_name: c.full_name, created_by: null, phone: '', email: null, nationality: null, notes: null, created_at: new Date().toISOString() } as Client]);
  }

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId || undefined,
          client_id: selectedClient || undefined,
          title: title || 'Untitled Booking',
          destination: destination || undefined,
          travel_start: travelStart || undefined,
          travel_end: travelEnd || undefined,
          pax_adults: paxAdults,
          pax_children: paxChildren,
          total_sell_price: totalSellPrice,
          total_cost_price: totalCostPrice,
          currency,
          special_requests: specialRequests || undefined,
          internal_notes: internalNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) router.push(`/bookings/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  if (loadingProposal) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading proposal data...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/bookings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">New Booking</h1>
        {proposalId && (
          <span className="text-sm text-muted-foreground">Created from proposal</span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Trip Details</CardTitle></CardHeader>
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
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Booking title" />
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <select className="w-full h-10 rounded-md border px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="AED">AED - Dirham</option>
                <option value="THB">THB - Thai Baht</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Travel Start</Label>
              <Input type="date" value={travelStart} onChange={(e) => setTravelStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Travel End</Label>
              <Input type="date" value={travelEnd} onChange={(e) => setTravelEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Adults</Label>
              <Input type="number" min={1} value={paxAdults} onChange={(e) => setPaxAdults(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Children</Label>
              <Input type="number" min={0} value={paxChildren} onChange={(e) => setPaxChildren(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Total Sell Price</Label>
            <Input type="number" min={0} value={totalSellPrice} onChange={(e) => setTotalSellPrice(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Total Cost Price</Label>
            <Input type="number" min={0} value={totalCostPrice} onChange={(e) => setTotalCostPrice(Number(e.target.value))} />
          </div>
          {totalSellPrice > 0 && (
            <div className="col-span-2 text-sm text-muted-foreground">
              Margin: {currency} {(totalSellPrice - totalCostPrice).toLocaleString()} ({((totalSellPrice - totalCostPrice) / totalSellPrice * 100).toFixed(1)}%)
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Special Requests (from client)</Label>
            <Textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Honeymoon setup, dietary requirements, etc." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal team notes..." rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/bookings')}>Cancel</Button>
        <Button onClick={handleCreate} disabled={loading || !title}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Booking
        </Button>
      </div>
    </div>
  );
}
