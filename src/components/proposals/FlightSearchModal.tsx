'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, X } from 'lucide-react';

interface FlightResult {
  id: string;
  airline: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  duration: string;
  price: number;
  class: string;
}

interface FlightSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectFlight: (flight: { flight_number: string; airline: string; origin: string; destination: string; departure_time: string; arrival_time: string; sp_total: number }) => void;
  currency?: string;
}

// Mock Tequila API search
async function mockFlightSearch(origin: string, destination: string, date: string): Promise<FlightResult[]> {
  void date; // used for API call in production
  await new Promise((r) => setTimeout(r, 1200));
  const airlines = ['Air India', 'IndiGo', 'Vistara', 'SpiceJet', 'GoFirst'];
  const results: FlightResult[] = [];
  for (let i = 0; i < 5; i++) {
    const airline = airlines[i % airlines.length];
    const code = airline === 'Air India' ? 'AI' : airline === 'IndiGo' ? '6E' : airline === 'Vistara' ? 'UK' : airline === 'SpiceJet' ? 'SG' : 'G8';
    const num = 100 + Math.floor(Math.random() * 900);
    const depHour = 6 + i * 3;
    const duration = 2 + Math.floor(Math.random() * 3);
    results.push({
      id: `${code}${num}`,
      airline,
      flight_number: `${code}-${num}`,
      origin: origin.toUpperCase().slice(0, 3),
      destination: destination.toUpperCase().slice(0, 3),
      departure_time: `${String(depHour).padStart(2, '0')}:${Math.random() > 0.5 ? '30' : '00'}`,
      arrival_time: `${String(depHour + duration).padStart(2, '0')}:${Math.random() > 0.5 ? '45' : '15'}`,
      duration: `${duration}h ${Math.floor(Math.random() * 50)}m`,
      price: 4000 + Math.floor(Math.random() * 12000),
      class: 'Economy',
    });
  }
  return results;
}

export function FlightSearchModal({ open, onClose, onSelectFlight, currency = 'INR' }: FlightSearchModalProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [results, setResults] = useState<FlightResult[]>([]);
  const [searching, setSearching] = useState(false);

  if (!open) return null;

  async function handleSearch() {
    if (!origin || !destination || !date) return;
    setSearching(true);
    const data = await mockFlightSearch(origin, destination, date);
    setResults(data);
    setSearching(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Search Live Flights (Tequila API)</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Origin</Label>
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="DEL" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="BOM" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSearch} disabled={searching || !origin || !destination || !date} className="w-full">
            {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Search Flights
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {results.map((flight) => (
            <div key={flight.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{flight.flight_number}</span>
                  <span className="text-xs text-muted-foreground">{flight.airline}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {flight.origin} {flight.departure_time} → {flight.destination} {flight.arrival_time} ({flight.duration})
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(flight.price)}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    onSelectFlight({
                      flight_number: flight.flight_number,
                      airline: flight.airline,
                      origin: flight.origin,
                      destination: flight.destination,
                      departure_time: flight.departure_time,
                      arrival_time: flight.arrival_time,
                      sp_total: flight.price,
                    });
                    onClose();
                  }}
                >
                  Select
                </Button>
              </div>
            </div>
          ))}
          {results.length === 0 && !searching && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Enter origin, destination and date to search for flights.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
