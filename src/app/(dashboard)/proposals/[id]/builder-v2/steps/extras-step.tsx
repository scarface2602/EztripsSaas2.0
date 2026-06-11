'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plane, Car, Ticket, StampIcon, Package, Trash2, Plus } from 'lucide-react';
import type { BuilderData, ItemRow, ItemType } from '../types';

interface StepProps {
  data: BuilderData;
  update: (patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => void;
}

const SECTIONS: { type: ItemType; label: string; icon: typeof Plane; placeholder: string }[] = [
  { type: 'flight', label: 'Flights', icon: Plane, placeholder: 'e.g. DEL → DPS, IndiGo 6E-23' },
  { type: 'transfer', label: 'Transfers', icon: Car, placeholder: 'e.g. Airport pickup, private car' },
  { type: 'activity', label: 'Activities & tours', icon: Ticket, placeholder: 'e.g. Nusa Penida day trip' },
  { type: 'visa', label: 'Visa & documents', icon: StampIcon, placeholder: 'e.g. Indonesia visa on arrival' },
  { type: 'other', label: 'Other', icon: Package, placeholder: 'Anything else' },
];

export function ExtrasStep({ data, update }: StepProps) {
  const addItem = (type: ItemType) =>
    update((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          id: crypto.randomUUID(),
          destination_id: null,
          price_group_id: null,
          item_type: type,
          title: '',
          details: {},
          hotel_directory_id: null,
          check_in: null,
          check_out: null,
          nights: null,
          source: 'manual',
          provider: null,
          provider_ref: null,
          cost_amount: null,
          sell_amount: null,
          sort_order: d.items.length,
        } satisfies ItemRow,
      ],
    }));

  const patchItem = (id: string, patch: Partial<ItemRow>) =>
    update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  const removeItem = (id: string) =>
    update((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

  const destinations = [...data.destinations].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ type, label, icon: Icon, placeholder }) => {
        const items = data.items.filter((i) => i.item_type === type);
        return (
          <Card key={type}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4" /> {label}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => addItem(type)}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardHeader>
            {items.length > 0 && (
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <Input
                      className="flex-1"
                      value={item.title}
                      onChange={(e) => patchItem(item.id, { title: e.target.value })}
                      placeholder={placeholder}
                    />
                    {type !== 'visa' && (
                      <Select
                        value={item.destination_id ?? 'none'}
                        onValueChange={(v) => patchItem(item.id, { destination_id: !v || v === 'none' ? null : v })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="City" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Whole trip</SelectItem>
                          {destinations.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.city_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      type="date"
                      className="w-40"
                      value={item.check_in ?? ''}
                      onChange={(e) => patchItem(item.id, { check_in: e.target.value || null })}
                    />
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Prices come next — on the Pricing step each of these is either covered by a package quote or priced on its own.
      </p>
    </div>
  );
}
