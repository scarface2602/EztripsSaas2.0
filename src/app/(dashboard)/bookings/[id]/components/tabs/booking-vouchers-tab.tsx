'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Package, Hotel, Plane, Car, MapPin, UtensilsCrossed, Briefcase,
  FileText, Mail, Loader2, Download, CheckCircle2, AlertTriangle, FileCheck,
} from 'lucide-react';
import { useBooking } from '../../booking-context';
import { format } from 'date-fns';
import { ITEM_TYPE_LABELS, SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS } from '@/lib/types/booking-items';
import { deriveTripConfirmation, isCoveredItem } from '@/lib/bookings/trip-confirmation';

const ITEM_ICONS: Record<string, typeof Hotel> = {
  hotel_room: Hotel, flight_segment: Plane, transfer: Car,
  activity: MapPin, meal_plan: UtensilsCrossed, dmc_package: Briefcase,
};

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  ...ITEM_TYPE_LABELS,
  hotel: 'Hotel', flight: 'Flight', vehicle: 'Vehicle', transfer: 'Transfer',
  activity: 'Activity', dmc_package: 'DMC Package', package: 'Trip Confirmation',
};

export function BookingVouchersTab() {
  const {
    bookingId, booking, items, packages, vouchers,
    generatingVoucher, generateVoucher,
    generatingTripConfirmation, generateTripConfirmation,
  } = useBooking();

  const trip = useMemo(() => deriveTripConfirmation(items, vouchers), [items, vouchers]);

  if (!booking) return null;

  const totalPaidFromPackages = packages.reduce((sum, pkg) =>
    sum + (pkg.payments || [])
      .filter((p) => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount_paid || 0), 0)
  , 0);
  const effectiveTotalPaid = Math.max(Number(booking.total_paid), totalPaidFromPackages);

  const confirmedCount = trip.gateItems.length - trip.blockingItems.length;

  return (
    <div className="space-y-4">
      {/* ── Trip Confirmation — the "everything comes together" document ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Trip Confirmation
            {trip.ready ? (
              <Badge className="bg-green-100 text-green-700 text-xs">Ready to issue</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {confirmedCount}/{trip.gateItems.length} components confirmed
              </Badge>
            )}
            {trip.latestVoucher && trip.stale && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">Outdated — items changed since issue</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trip.blockingItems.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
              <p className="text-muted-foreground">Waiting on supplier confirmation for:</p>
              {trip.blockingItems.map((i) => (
                <div key={i.id} className="flex items-center gap-2">
                  <span className="font-medium">{i.label}</span>
                  <Badge className={(SUPPLIER_STATUS_COLORS[i.supplier_status as keyof typeof SUPPLIER_STATUS_COLORS] || '') + ' text-xs'}>
                    {SUPPLIER_STATUS_LABELS[i.supplier_status as keyof typeof SUPPLIER_STATUS_LABELS] || i.supplier_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {trip.ready && trip.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-1">
              {trip.warnings.map((w) => (
                <div key={w.id} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {trip.ready && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              All components are supplier-confirmed — the consolidated trip confirmation can be issued.
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!trip.ready || generatingTripConfirmation}
              onClick={() => generateTripConfirmation(false)}
            >
              {generatingTripConfirmation ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
              {trip.latestVoucher ? 'Regenerate' : 'Generate'} Trip Confirmation
            </Button>
            <Button
              size="sm"
              disabled={!trip.ready || generatingTripConfirmation || !booking.clients?.email}
              onClick={() => generateTripConfirmation(true)}
              title={booking.clients?.email ? `Send to ${booking.clients.email}` : 'No client email'}
            >
              {generatingTripConfirmation ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
              Generate & Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Individual service vouchers ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Service Vouchers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No booking items to generate vouchers for.</p>
          )}
          {items.map((item) => {
            const Icon = ITEM_ICONS[item.item_type] || Package;
            const isGenerating = generatingVoucher === item.id;
            const covered = isCoveredItem(item);
            const existingVoucher = vouchers.find((v) => v.item_id === item.id && v.voucher_type !== 'package');
            return (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type}
                      </Badge>
                      <Badge className={(SUPPLIER_STATUS_COLORS[item.supplier_status as keyof typeof SUPPLIER_STATUS_COLORS] || '') + ' text-xs'}>
                        {SUPPLIER_STATUS_LABELS[item.supplier_status as keyof typeof SUPPLIER_STATUS_LABELS]}
                      </Badge>
                      {covered && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          Covered by {String((item.details as Record<string, unknown>)?.covered_by || 'package')}
                        </Badge>
                      )}
                      {existingVoucher && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          Voucher issued
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {covered ? (
                  <p className="text-xs text-muted-foreground">Included in the package voucher</p>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isGenerating}
                      onClick={() => generateVoucher(item)}
                    >
                      {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                      {existingVoucher ? 'Regenerate' : 'Generate'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={isGenerating || !booking.clients?.email}
                      onClick={() => generateVoucher(item, true)}
                      title={booking.clients?.email ? `Send to ${booking.clients.email}` : 'No client email'}
                    >
                      {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                      Generate & Email
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          <div className={`p-3 rounded-lg text-sm ${effectiveTotalPaid >= Number(booking.cost_price) && Number(booking.cost_price) > 0 ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'}`}>
            {effectiveTotalPaid >= Number(booking.cost_price) && Number(booking.cost_price) > 0 ? (
              <p className="text-green-800 dark:text-green-200">Fully paid — vouchers will show <strong>CONFIRMED</strong> with confirmation numbers.</p>
            ) : (
              <p className="text-amber-800 dark:text-amber-200">Partially paid (₹{effectiveTotalPaid.toLocaleString()} / ₹{Number(booking.cost_price).toLocaleString()}) — vouchers will show <strong>BLOCKED</strong> without confirmation numbers.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {vouchers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Issued Vouchers ({vouchers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Emailed</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.voucher_number}</TableCell>
                    <TableCell>{VOUCHER_TYPE_LABELS[v.voucher_type] || v.voucher_type}</TableCell>
                    <TableCell className="text-sm">{v.created_at ? format(new Date(v.created_at), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                    <TableCell>
                      {v.sent_at ? (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                          <Mail className="h-3 w-3 mr-1" /> Sent
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not sent</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v.pdf_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/api/bookings/${bookingId}/vouchers/${v.id}`, '_blank')}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> PDF
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
