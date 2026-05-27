'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Package, Info } from 'lucide-react';
import type { BookingItem } from '@/lib/types/booking-items';
import type { Proposal } from '@/lib/types/database';

interface OrganizePackagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  bookingItems: BookingItem[];
  onConfirm: (packages: Array<{
    type: 'full_dmc' | 'partial_dmc' | 'mixed' | 'individual';
    supplier_id?: string;
    booking_items_ids: string[];
    total_cost: number;
  }>) => Promise<void>;
  isLoading?: boolean;
}

const STRUCTURE_HELPERS: Record<'full_dmc' | 'partial_dmc' | 'mixed' | 'individual' | 'undecided', string> = {
  full_dmc: 'Group all items under a single DMC supplier',
  partial_dmc: 'Separate DMC items from online vendors',
  mixed: 'Each vendor gets its own package (most common for mixed bookings)',
  individual: 'Single vendor package',
  undecided: 'Manual organization - adjust as needed',
};

export function OrganizePackagesDialog({
  open,
  onOpenChange,
  proposal,
  bookingItems,
  onConfirm,
  isLoading = false,
}: OrganizePackagesDialogProps) {
  const [packages] = useState<Array<{
    type: 'full_dmc' | 'partial_dmc' | 'mixed' | 'individual';
    supplier_id?: string;
    booking_items_ids: string[];
    total_cost: number;
  }> | null>(null);

  // Auto-organize on first open based on structure type
  const autoOrganized = useMemo(() => {
    if (packages !== null) return packages;

    const organized: Array<{
      type: 'full_dmc' | 'partial_dmc' | 'mixed' | 'individual';
      supplier_id?: string;
      booking_items_ids: string[];
      total_cost: number;
    }> = [];

    if (proposal.booking_structure_type === 'full_dmc') {
      // Group all items together
      const totalCost = bookingItems.reduce((sum, item) => sum + (item.sell_price || 0), 0);
      organized.push({
        type: 'full_dmc',
        supplier_id: undefined,
        booking_items_ids: bookingItems.map((item) => item.id),
        total_cost: totalCost,
      });
    } else if (proposal.booking_structure_type === 'partial_dmc') {
      // Separate by supplier type (DMC vs others)
      const dmcItems = bookingItems.filter((item) => item.vendor_name?.toLowerCase().includes('dmc'));
      const otherItems = bookingItems.filter((item) => !item.vendor_name?.toLowerCase().includes('dmc'));

      if (dmcItems.length > 0) {
        const dmcCost = dmcItems.reduce((sum, item) => sum + (item.sell_price || 0), 0);
        organized.push({
          type: 'partial_dmc',
          supplier_id: undefined,
          booking_items_ids: dmcItems.map((item) => item.id),
          total_cost: dmcCost,
        });
      }

      if (otherItems.length > 0) {
        const otherCost = otherItems.reduce((sum, item) => sum + (item.sell_price || 0), 0);
        organized.push({
          type: 'mixed',
          supplier_id: undefined,
          booking_items_ids: otherItems.map((item) => item.id),
          total_cost: otherCost,
        });
      }
    } else if (proposal.booking_structure_type === 'mixed' || proposal.booking_structure_type === 'undecided') {
      // One package per vendor
      const byVendor = new Map<string, typeof bookingItems>();
      bookingItems.forEach((item) => {
        const vendor = item.vendor_name || 'Other';
        if (!byVendor.has(vendor)) {
          byVendor.set(vendor, []);
        }
        byVendor.get(vendor)!.push(item);
      });

      byVendor.forEach((items) => {
        const cost = items.reduce((sum, item) => sum + (item.sell_price || 0), 0);
        organized.push({
          type: 'individual',
          supplier_id: undefined,
          booking_items_ids: items.map((item) => item.id),
          total_cost: cost,
        });
      });
    }

    return organized.length > 0 ? organized : null;
  }, [bookingItems, proposal.booking_structure_type, packages]);

  const currentPackages = packages !== null ? packages : autoOrganized;

  function handleConfirm() {
    if (!currentPackages || currentPackages.length === 0) {
      return;
    }
    onConfirm(currentPackages);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Organize Booking Packages
          </DialogTitle>
          <DialogDescription>
            Group booking items into packages. Each package will have its own payment schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info section */}
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              Based on your booking structure ({proposal.booking_structure_type || 'undecided'}
              ), items have been pre-organized below. Adjust as needed.
            </div>
          </div>

          {/* Packages */}
          <div className="space-y-3">
            {currentPackages && currentPackages.length > 0 ? (
              currentPackages.map((pkg, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Package {idx + 1}: {pkg.type === 'full_dmc' ? 'Full DMC' : pkg.type === 'partial_dmc' ? 'Partial DMC' : 'Individual'}
                      </CardTitle>
                      <Badge variant="outline">₹{pkg.total_cost.toLocaleString()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Items in package */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Items ({pkg.booking_items_ids.length})</Label>
                      <div className="space-y-1">
                        {pkg.booking_items_ids.map((itemId) => {
                          const item = bookingItems.find((i) => i.id === itemId);
                          return (
                            <div key={itemId} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                              <span>{item?.label}</span>
                              <span className="text-muted-foreground">₹{(item?.sell_price || 0).toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Type selector (can be changed) */}
                    <div className="space-y-2">
                      <Label className="text-xs">Package Type</Label>
                      <Select value={pkg.type} disabled>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_dmc">Full DMC</SelectItem>
                          <SelectItem value="partial_dmc">Partial DMC</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{STRUCTURE_HELPERS[pkg.type]}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No items to organize
              </div>
            )}
          </div>

          {/* Summary */}
          {currentPackages && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-900">
                Ready to create <strong>{currentPackages.length} booking package{currentPackages.length !== 1 ? 's' : ''}</strong> with custom payment schedules.
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!currentPackages || currentPackages.length === 0 || isLoading}>
            {isLoading ? 'Creating...' : 'Create Booking'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
