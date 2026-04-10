'use client';

import type { Proposal, Hotel, Flight, CancellationSlab } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

interface CancellationPolicySectionProps {
  proposal: Proposal;
  updateProposal: (updates: Partial<Proposal>) => void;
  hotels: Hotel[];
  flights: Flight[];
}

export function CancellationPolicySection({ proposal, updateProposal, hotels, flights }: CancellationPolicySectionProps) {
  // Land/DMC cancellation slabs stored in draft_data
  const draftData = (proposal.draft_data || {}) as Record<string, unknown>;
  const landSlabs = (draftData.land_cancellation_slabs as CancellationSlab[]) || [];

  function setLandSlabs(slabs: CancellationSlab[]) {
    updateProposal({
      draft_data: {
        ...(proposal.draft_data || {}),
        land_cancellation_slabs: slabs,
      } as Record<string, unknown>,
    });
  }

  function addLandSlab() {
    setLandSlabs([...landSlabs, { days_before: 30, charge_pct: 25 }]);
  }

  function updateLandSlab(index: number, updates: Partial<CancellationSlab>) {
    const updated = [...landSlabs];
    updated[index] = { ...updated[index], ...updates };
    setLandSlabs(updated);
  }

  function removeLandSlab(index: number) {
    setLandSlabs(landSlabs.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader><CardTitle>Cancellation Policy</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {/* Flights */}
        <div>
          <h3 className="font-medium mb-2">Flights</h3>
          {flights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flights</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flight</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flights.map(f => (
                  <TableRow key={f.id}>
                    <TableCell>{f.flight_number} {f.airline ? `(${f.airline})` : ''}</TableCell>
                    <TableCell>
                      {f.is_non_refundable
                        ? <Badge className="bg-red-100 text-red-700">Non-refundable from ticketing</Badge>
                        : <Badge className="bg-green-100 text-green-700">Refundable</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Hotels */}
        <div>
          <h3 className="font-medium mb-2">Hotels</h3>
          {hotels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hotels</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cancellation Slabs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hotels.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>
                      {h.is_non_refundable
                        ? <Badge className="bg-red-100 text-red-700">Non-refundable</Badge>
                        : <Badge className="bg-green-100 text-green-700">Refundable</Badge>}
                    </TableCell>
                    <TableCell>
                      {!h.is_non_refundable && h.hotel_cancellation_slabs?.length
                        ? h.hotel_cancellation_slabs.map((s, i) => (
                          <span key={i} className="text-sm">{s.days_before}d: {s.charge_pct}%{i < h.hotel_cancellation_slabs!.length - 1 ? ' | ' : ''}</span>
                        ))
                        : h.is_non_refundable ? '100% from booking' : 'No slabs set'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Land/DMC */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Land / DMC Cancellation</h3>
            <Button size="sm" variant="outline" onClick={addLandSlab}><Plus className="h-3 w-3 mr-1" /> Add Slab</Button>
          </div>
          {landSlabs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No land cancellation slabs set</p>
          ) : (
            <div className="space-y-2">
              {landSlabs.map((slab, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="number" className="w-24" value={slab.days_before} onChange={(e) => updateLandSlab(i, { days_before: Number(e.target.value) })} />
                  <span className="text-sm">+ days →</span>
                  <Input type="number" className="w-20" min={0} max={100} value={slab.charge_pct} onChange={(e) => updateLandSlab(i, { charge_pct: Math.min(100, Math.max(0, Number(e.target.value))) })} />
                  <span className="text-sm">%</span>
                  {slab.charge_pct > 100 && <span className="text-xs text-red-600">Max 100%</span>}
                  <Button size="sm" variant="ghost" onClick={() => removeLandSlab(i)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real Risk Summary */}
        <div className="p-4 bg-muted/50 rounded-md">
          <h3 className="font-medium mb-2">Real Risk Summary</h3>
          <p className="text-sm text-muted-foreground">Shows total client exposure at different cancellation windows (30 / 15 / 7 days before departure).</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Window</TableHead>
                <TableHead>Flights</TableHead>
                <TableHead>Hotels</TableHead>
                <TableHead>Land</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[30, 15, 7].map(days => {
                const flightRisk = flights.filter(f => f.is_non_refundable).reduce((s, f) => s + (f.sp_total || 0), 0);
                const hotelRisk = hotels.reduce((s, h) => {
                  if (h.is_non_refundable) return s + (h.sp_per_night || 0) * (h.nights || 0);
                  const slab = (h.hotel_cancellation_slabs || []).find(sl => sl.days_before >= days);
                  if (slab) return s + ((h.sp_per_night || 0) * (h.nights || 0) * slab.charge_pct / 100);
                  return s;
                }, 0);
                const landSlab = landSlabs.find(sl => sl.days_before >= days);
                const landRiskPct = landSlab?.charge_pct || 0;

                return (
                  <TableRow key={days}>
                    <TableCell className="font-medium">{days} days</TableCell>
                    <TableCell>{flightRisk > 0 ? flightRisk.toLocaleString('en-IN') : '0'}</TableCell>
                    <TableCell>{hotelRisk > 0 ? hotelRisk.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}</TableCell>
                    <TableCell>{landRiskPct}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
