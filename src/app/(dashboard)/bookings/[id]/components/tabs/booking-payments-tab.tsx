'use client';

import { BookingERP } from '@/components/booking-erp';
import { PaymentLinkGenerator } from '@/components/payment-link-generator';
import { useBooking } from '../../booking-context';

export function BookingPaymentsTab() {
  const { bookingId, booking, items, packages, fetchAll } = useBooking();

  if (!booking) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PaymentLinkGenerator bookingId={bookingId} currency={booking.currency || 'INR'} />
      </div>

      <BookingERP
        activeTab="accounts"
        currency={booking.currency || 'INR'}
        travelStartDate={booking.travel_start || ''}
        clientTotal={booking.sell_price || 0}
        supplierNames={items
          .filter((item: any) => item.vendor_name)
          .reduce((acc: any, item: any) => {
            const existing = acc.find((s: { name: string }) => s.name === item.vendor_name);
            if (existing) {
              existing.amount += (item.cost_price || 0);
            } else {
              acc.push({ id: item.id, name: item.vendor_name!, amount: item.cost_price || 0 });
            }
            return acc;
          }, [] as Array<{ id: string; name: string; amount: number }>)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        installmentData={packages.flatMap((pkg: any) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (pkg.payments || []).map((p: any, i: number) => ({
            id: p.id,
            label: p.label || `Installment ${i + 1}`,
            amount: Number(p.amount),
            dueDate: p.due_date || '',
            cleared: p.status === 'paid',
          }))
        )}
        supplierData={items
          .filter((item: any) => item.vendor_name)
          .map((item: any) => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id: (item as any).supplier_id || item.id,
            name: item.vendor_name!,
            amount: item.cost_price || 0,
            paid: item.supplier_status === 'confirmed' || item.supplier_status === 'completed',
            paymentRequested: item.supplier_status === 'confirmation_requested',
          }))}
        bookingId={bookingId}
        onInstallmentCleared={async (paymentId: string) => {
          const payment = packages
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .flatMap((p: any) => p.payments || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .find((p: any) => p.id === paymentId);
          await fetch(`/api/bookings/${bookingId}/financials`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId,
              packageId: payment?.package_id,
              status: 'paid',
              amount_paid: Number(payment?.amount || 0),
            }),
          });
          fetchAll();
        }}
        onSupplierPaid={async (supplierId: string, utr: string) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const supplierItem = items.find((i: any) => ((i as any).supplier_id || i.id) === supplierId);
          if (!supplierItem) return;
          const supplierPayment = packages
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .flatMap((p: any) => p.payments || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .find((p: any) => p.supplier_id === supplierId && p.status !== 'paid');
          if (supplierPayment) {
            await fetch(`/api/bookings/${bookingId}/financials`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paymentId: supplierPayment.id,
                packageId: supplierPayment.package_id,
                status: 'paid',
                reference_number: utr,
                amount_paid: Number(supplierPayment.amount || 0),
              }),
            });
          }
          fetchAll();
        }}
      />
    </div>
  );
}
