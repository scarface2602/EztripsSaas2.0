'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Hotel, Plane, Car, MapPin, UtensilsCrossed, Briefcase, ChevronDown, ChevronUp, Trash2, Save } from 'lucide-react';
import { useBooking } from '../../booking-context';
import { format } from 'date-fns';
import type { BookingItem, SupplierStatus } from '@/lib/types/booking-items';
import { ITEM_TYPE_LABELS, SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS, STATUS_TRANSITIONS } from '@/lib/types/booking-items';

const ITEM_ICONS: Record<string, typeof Hotel> = {
  hotel_room: Hotel, flight_segment: Plane, transfer: Car,
  activity: MapPin, meal_plan: UtensilsCrossed, dmc_package: Briefcase,
};

function buildDetailSummary(itemType: string, details: Record<string, unknown>): string {
  switch (itemType) {
    case 'hotel_room': {
      const parts: string[] = [];
      if (details.room_type) parts.push(String(details.room_type));
      if (details.meal_plan) parts.push(String(details.meal_plan));
      if (details.nights) parts.push(`${details.nights}N`);
      return parts.join(' · ');
    }
    case 'flight_segment': {
      const parts: string[] = [];
      if (details.airline) parts.push(String(details.airline));
      if (details.cabin_class) parts.push(String(details.cabin_class));
      return parts.join(' · ');
    }
    case 'transfer':
    case 'vehicle': {
      const parts: string[] = [];
      const brand = details.vehicle_brand || details.vehicle_brand_name;
      if (brand) parts.push(String(brand));
      if (details.vehicle_type) parts.push(String(details.vehicle_type));
      return parts.join(' · ') || 'Vehicle Details';
    }
    case 'dmc_package': {
      const count = (Number(details.activity_count) || 0) + (Number(details.line_item_count) || 0);
      return count > 0 ? `${count} components` : '';
    }
    default:
      return details.location ? String(details.location) : '';
  }
}

function ItemCard({
  item, currency, isExpanded, onToggle, onUpdateStatus, onDelete, outstandingBalance,
}: {
  item: BookingItem;
  currency: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (status: SupplierStatus, vendorData: Record<string, unknown>) => void;
  onDelete: () => void;
  outstandingBalance: number;
}) {
  const Icon = ITEM_ICONS[item.item_type] || Package;
  const nextStatuses = STATUS_TRANSITIONS[item.supplier_status] || [];

  const details = item.details as Record<string, unknown>;
  const autoVendorName = item.vendor_name || (details.hotel_name as string) || (details.airline as string) || '';

  const [pendingStatus, setPendingStatus] = useState<SupplierStatus | null>(null);
  const [vendorChannel, setVendorChannel] = useState<'online' | 'offline'>(item.portal_name ? 'online' : 'offline');
  const [vendorName, setVendorName] = useState(autoVendorName);
  const [vendorEmail, setVendorEmail] = useState(item.vendor_email || '');
  const [portalName, setPortalName] = useState(item.portal_name || '');
  const [paymentDueDate] = useState(item.payment_due_date || '');
  const [supplierRef, setSupplierRef] = useState(item.supplier_reference || '');
  const [supplierNotes, setSupplierNotes] = useState(item.supplier_notes || '');

  const handleStatusClick = (status: SupplierStatus) => setPendingStatus(status);

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    const vendorData: Record<string, unknown> = {};
    if (vendorName) vendorData.vendor_name = vendorName;
    if (vendorEmail) vendorData.vendor_email = vendorEmail;
    if (portalName) vendorData.portal_name = portalName;
    if (paymentDueDate) vendorData.payment_due_date = paymentDueDate;
    if (supplierRef) vendorData.supplier_reference = supplierRef;
    if (supplierNotes) vendorData.supplier_notes = supplierNotes;
    onUpdateStatus(pendingStatus, vendorData);
    setPendingStatus(null);
  };

  const detailSummary = buildDetailSummary(item.item_type, details);

  return (
    <Card className={`${item.supplier_status === 'confirmed' || item.supplier_status === 'completed' ? 'border-green-200' : item.supplier_status === 'pending' ? 'border-red-200' : 'border-yellow-200'}`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.label}</span>
            <Badge variant="outline" className="shrink-0 text-xs">{ITEM_TYPE_LABELS[item.item_type]}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {item.start_date && <span>{format(new Date(item.start_date), 'dd MMM yyyy')}{item.end_date && item.end_date !== item.start_date ? ` – ${format(new Date(item.end_date), 'dd MMM yyyy')}` : ''}</span>}
            {detailSummary && <span>· {detailSummary}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {item.quoted_cost != null && item.cost_price != null && Number(item.quoted_cost) !== Number(item.cost_price) && (
            <Badge
              variant="outline"
              className={Number(item.quoted_cost) > Number(item.cost_price)
                ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
                : 'text-red-700 border-red-300 bg-red-50'}
              title={`Quoted cost: ${currency} ${Number(item.quoted_cost).toLocaleString()}`}
            >
              {Number(item.quoted_cost) > Number(item.cost_price) ? '+' : '−'}{currency} {Math.abs(Number(item.quoted_cost) - Number(item.cost_price)).toLocaleString()} vs quote
            </Badge>
          )}
          {item.cost_price != null && (
            <span className="text-sm text-muted-foreground">{currency} {Number(item.cost_price).toLocaleString()}</span>
          )}
          <Badge className={SUPPLIER_STATUS_COLORS[item.supplier_status]}>
            {SUPPLIER_STATUS_LABELS[item.supplier_status]}
          </Badge>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(details)
              .filter(([k, v]) => v != null && v !== '' && k !== 'supplier_id')
              .map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                <p className="text-sm font-medium">
                  {typeof v === 'object' && !Array.isArray(v) && v !== null
                    ? Object.entries(v as Record<string, unknown>)
                        .filter(([, val]) => val != null && val !== 0)
                        .map(([key, val]) => `${val} ${key.charAt(0).toUpperCase() + key.slice(1)}`)
                        .join(', ')
                    : Array.isArray(v) ? v.join(', ') : String(v)}
                </p>
              </div>
            ))}
            <div>
              <p className="text-xs text-muted-foreground">Cost Price</p>
              <p className="text-sm font-medium">{item.cost_price != null ? `${currency} ${Number(item.cost_price).toLocaleString()}` : '-'}</p>
              {item.quoted_cost != null && Number(item.quoted_cost) !== Number(item.cost_price ?? 0) && (
                <p className="text-xs text-muted-foreground">Quoted: {currency} {Number(item.quoted_cost).toLocaleString()}{item.quoted_vendor_name && item.quoted_vendor_name !== item.vendor_name ? ` (${item.quoted_vendor_name})` : ''}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sell Price</p>
              <p className="text-sm font-medium">{item.sell_price != null ? `${currency} ${Number(item.sell_price).toLocaleString()}` : '-'}</p>
            </div>
          </div>

          {(item.vendor_name || item.vendor_email || item.portal_name || item.payment_due_date || item.supplier_reference) && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Vendor & Confirmation</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {item.vendor_name && <div><span className="text-xs text-muted-foreground">Vendor</span><p className="font-medium">{item.vendor_name}</p></div>}
                {item.vendor_email && <div><span className="text-xs text-muted-foreground">Email</span><p className="font-medium">{item.vendor_email}</p></div>}
                {item.portal_name && <div><span className="text-xs text-muted-foreground">Portal</span><p className="font-medium">{item.portal_name}</p></div>}
                {item.payment_due_date && <div><span className="text-xs text-muted-foreground">Payment Due</span><p className="font-medium">{format(new Date(item.payment_due_date), 'dd MMM yyyy')}</p></div>}
                {item.supplier_reference && <div><span className="text-xs text-muted-foreground">Ref / Confirmation #</span><p className="font-medium font-mono">{item.supplier_reference}</p></div>}
              </div>
            </div>
          )}

          {pendingStatus && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                Update to: {SUPPLIER_STATUS_LABELS[pendingStatus]}
              </p>
              {pendingStatus === 'confirmed' && outstandingBalance > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-md p-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    ⚠ Outstanding balance: ₹{outstandingBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Payment is not fully cleared. You can still confirm, but ensure the remaining amount is settled before travel dates.
                  </p>
                </div>
              )}
              {['confirmation_requested', 'on_hold', 'confirmed'].includes(pendingStatus) && !item.vendor_name && !item.portal_name && (
                <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                  <button
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${vendorChannel === 'offline' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => { setVendorChannel('offline'); setPortalName(''); }}
                  >
                    Offline Supplier
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${vendorChannel === 'online' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => { setVendorChannel('online'); setVendorName(''); }}
                  >
                    Online Portal
                  </button>
                </div>
              )}
              {['confirmation_requested', 'on_hold', 'confirmed'].includes(pendingStatus) && (item.vendor_name || item.portal_name) && (
                <p className="text-xs text-muted-foreground">
                  Supplier: <span className="font-medium text-foreground">{item.vendor_name || item.portal_name}</span>
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingStatus === 'confirmation_requested' && (
                  <>
                    {!item.vendor_name && !item.portal_name && (
                      vendorChannel === 'offline' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Name</Label>
                          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Taj Hotels, Air India" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Vendor Portal</Label>
                          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. TBO, Booking.com, Via.com" />
                        </div>
                      )
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Mail Sent To (email)</Label>
                      <Input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="vendor@example.com" />
                    </div>
                  </>
                )}
                {pendingStatus === 'on_hold' && (
                  <>
                    {!item.vendor_name && !item.portal_name && (
                      vendorChannel === 'offline' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Name</Label>
                          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Supplier name" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Blocked On Portal</Label>
                          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. TBO, Booking.com, Via.com" />
                        </div>
                      )
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Supplier Reference</Label>
                      <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Booking ref / hold ID" />
                    </div>
                  </>
                )}
                {pendingStatus === 'confirmed' && (
                  <>
                    {!item.vendor_name && !item.portal_name && (
                      vendorChannel === 'offline' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Name</Label>
                          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Supplier name" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Confirmed On Portal</Label>
                          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. TBO, Booking.com, Via.com" />
                        </div>
                      )
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Confirmation / PNR #</Label>
                      <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Confirmation number" />
                    </div>
                  </>
                )}
                {pendingStatus === 'cancelled' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Cancellation Reason</Label>
                    <Input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Reason for cancellation..." />
                  </div>
                )}
                {pendingStatus !== 'cancelled' && (
                  <div className="col-span-full space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Any additional notes..." />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmStatusChange}
                  className={pendingStatus === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : ''}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {pendingStatus === 'cancelled' ? 'Confirm Cancellation' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPendingStatus(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {!pendingStatus && nextStatuses.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Update status:</span>
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className={s === 'confirmed' ? 'border-green-300 text-green-700 hover:bg-green-50' : s === 'cancelled' ? 'border-red-300 text-red-700 hover:bg-red-50' : ''}
                  onClick={() => handleStatusClick(s)}
                >
                  {SUPPLIER_STATUS_LABELS[s]}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="text-red-500 ml-auto" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            </div>
          )}

          {item.supplier_notes && !pendingStatus && (
            <p className="text-xs text-muted-foreground italic">Notes: {item.supplier_notes}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function BookingItemsTab() {
  const { booking, items, packages, updateItem, deleteItem } = useBooking();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  if (!booking) return null;

  const totalPaidFromPackages = packages.reduce((sum, pkg) =>
    sum + (pkg.payments || [])
      .filter((p) => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount_paid || 0), 0)
  , 0);
  const effectiveTotalPaid = Math.max(Number(booking.total_paid), totalPaidFromPackages);
  const balance = Number(booking.cost_price) - effectiveTotalPaid;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No items. Items are auto-created when a booking is made from a proposal.</CardContent></Card>
      ) : items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          currency={booking.currency}
          isExpanded={expandedItemId === item.id}
          onToggle={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
          onUpdateStatus={(status, vendorData) => updateItem(item.id, { supplier_status: status, ...vendorData })}
          onDelete={() => deleteItem(item.id)}
          outstandingBalance={balance}
        />
      ))}
      {items.length > 0 && (
        <div className="flex justify-end gap-6 text-sm text-muted-foreground pt-2">
          {(() => {
            const marginDelta = items.reduce((s, i) =>
              s + (i.quoted_cost != null && i.cost_price != null ? Number(i.quoted_cost) - Number(i.cost_price) : 0), 0);
            if (marginDelta === 0) return null;
            return (
              <span className={marginDelta > 0 ? 'text-emerald-700' : 'text-red-700'}>
                Margin vs quote: <strong>{marginDelta > 0 ? '+' : '−'}{booking.currency} {Math.abs(marginDelta).toLocaleString()}</strong>
              </span>
            );
          })()}
          <span>Total Cost: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.cost_price || 0), 0).toLocaleString()}</strong></span>
          <span>Total Sell: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.sell_price || 0), 0).toLocaleString()}</strong></span>
        </div>
      )}
    </div>
  );
}
