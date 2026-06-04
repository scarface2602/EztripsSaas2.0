'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Save, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

interface Passenger {
  id?: string;
  type: string;
  title: string | null;
  first_name: string;
  last_name: string | null;
  dob: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  passport_document_url: string | null;
}

export function BookingPassengers({ bookingId }: { bookingId: string }) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPax, setNewPax] = useState<Passenger>({
    type: 'adult', title: null, first_name: '', last_name: null,
    dob: null, passport_number: null, passport_expiry: null, passport_document_url: null,
  });

  const fetchPassengers = useCallback(async () => {
    const res = await fetch(`/api/bookings/${bookingId}/passengers`);
    if (res.ok) {
      const data = await res.json();
      setPassengers(data.passengers || []);
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { fetchPassengers(); }, [fetchPassengers]);

  const handleUpdate = async (pax: Passenger) => {
    if (!pax.id) return;
    setSaving(pax.id);
    const res = await fetch(`/api/bookings/${bookingId}/passengers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passenger_id: pax.id, ...pax }),
    });
    if (res.ok) {
      toast.success('Passenger updated');
    } else {
      toast.error('Failed to update');
    }
    setSaving(null);
  };

  const handleAdd = async () => {
    if (!newPax.first_name.trim()) {
      toast.error('Name is required');
      return;
    }
    setAdding(true);
    const res = await fetch(`/api/bookings/${bookingId}/passengers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passengers: [newPax] }),
    });
    if (res.ok) {
      const data = await res.json();
      setPassengers(prev => [...prev, ...(data.passengers || [])]);
      setNewPax({
        type: 'adult', title: null, first_name: '', last_name: null,
        dob: null, passport_number: null, passport_expiry: null, passport_document_url: null,
      });
      toast.success('Passenger added');
    } else {
      toast.error('Failed to add passenger');
    }
    setAdding(false);
  };

  const updateField = (idx: number, field: keyof Passenger, value: string | null) => {
    setPassengers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" /> Passenger Manifest
          <Badge variant="outline" className="text-xs">{passengers.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {passengers.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Passport</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passengers.map((pax, idx) => (
                  <TableRow key={pax.id || idx}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{pax.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Input
                          value={pax.first_name || ''}
                          onChange={e => updateField(idx, 'first_name', e.target.value)}
                          placeholder="First"
                          className="h-7 text-xs w-24"
                        />
                        <Input
                          value={pax.last_name || ''}
                          onChange={e => updateField(idx, 'last_name', e.target.value)}
                          placeholder="Last"
                          className="h-7 text-xs w-24"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={pax.dob || ''}
                        onChange={e => updateField(idx, 'dob', e.target.value)}
                        className="h-7 text-xs w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={pax.passport_number || ''}
                        onChange={e => updateField(idx, 'passport_number', e.target.value)}
                        placeholder="Passport"
                        className="h-7 text-xs w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={pax.passport_expiry || ''}
                        onChange={e => updateField(idx, 'passport_expiry', e.target.value)}
                        className="h-7 text-xs w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleUpdate(pax)}
                        disabled={saving === pax.id}
                      >
                        {saving === pax.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add passenger form */}
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Add Passenger</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <Label className="text-[10px]">Type</Label>
              <Select value={newPax.type} onValueChange={v => setNewPax(p => ({ ...p, type: v || 'adult' }))}>
                <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">Adult</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">First Name</Label>
              <Input
                value={newPax.first_name}
                onChange={e => setNewPax(p => ({ ...p, first_name: e.target.value }))}
                placeholder="First name"
                className="h-7 text-xs w-28"
              />
            </div>
            <div>
              <Label className="text-[10px]">Last Name</Label>
              <Input
                value={newPax.last_name || ''}
                onChange={e => setNewPax(p => ({ ...p, last_name: e.target.value }))}
                placeholder="Last name"
                className="h-7 text-xs w-28"
              />
            </div>
            <div>
              <Label className="text-[10px]">DOB</Label>
              <Input
                type="date"
                value={newPax.dob || ''}
                onChange={e => setNewPax(p => ({ ...p, dob: e.target.value }))}
                className="h-7 text-xs w-32"
              />
            </div>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
