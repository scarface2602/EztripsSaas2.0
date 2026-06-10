'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { BookingItem } from '@/lib/types/booking-items';
import type { PaymentAccount } from '@/lib/types/database';
import type {
  PackageWithPayments,
  BookingLogEntry,
  BookingEmailRecord,
  BookingVoucherRecord,
  TeamMember,
  EnquiryRecord,
} from '@/lib/types/booking-detail';

export interface Booking {
  id: string;
  proposal_id: string | null;
  title: string;
  booking_type: string;
  reference_number: string | null;
  destination: string | null;
  status: string;
  travel_start: string | null;
  travel_end: string | null;
  pax_adults: number;
  pax_children: number;
  sell_price: number;
  cost_price: number;
  total_paid: number;
  next_payment_date: string | null;
  next_payment_amount: number | null;
  currency: string;
  blocking_reference: string | null;
  blocking_expires_at: string | null;
  internal_notes: string | null;
  min_confirmation_amount: number | null;
  created_at: string;
  clients: { full_name: string; phone: string | null; email: string | null } | null;
  suppliers: { name: string } | null;
  proposals: { title: string; quote_type: string; enquiry_id: string | null; draft_data: Record<string, unknown> | null } | null;
  trip_id: string | null;
}

interface BookingContextType {
  bookingId: string;
  booking: Booking | null;
  items: BookingItem[];
  packages: PackageWithPayments[];
  paymentAccounts: PaymentAccount[];
  vouchers: BookingVoucherRecord[];
  logs: BookingLogEntry[];
  emails: BookingEmailRecord[];
  teamMembers: TeamMember[];
  enquiry: EnquiryRecord | null;
  loading: boolean;
  saving: boolean;
  generatingVoucher: string | null;
  fetchAll: () => Promise<void>;
  updateBooking: (updates: Record<string, unknown>) => Promise<void>;
  updateItem: (itemId: string, updates: Record<string, unknown>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  generateVoucher: (item: BookingItem, sendEmail?: boolean) => Promise<void>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ bookingId, children }: { bookingId: string; children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [items, setItems] = useState<BookingItem[]>([]);
  const [packages, setPackages] = useState<PackageWithPayments[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [vouchers, setVouchers] = useState<BookingVoucherRecord[]>([]);
  const [logs, setLogs] = useState<BookingLogEntry[]>([]);
  const [emails, setEmails] = useState<BookingEmailRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [enquiry, setEnquiry] = useState<EnquiryRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingVoucher, setGeneratingVoucher] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, lRes, eRes, iRes] = await Promise.all([
      supabase.from('bookings').select('*, clients(full_name, phone, email), suppliers(name), proposals(title, quote_type, enquiry_id, draft_data)').eq('id', bookingId).single(),
      supabase.from('booking_logs').select('*, users(full_name)').eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(50),
      supabase.from('booking_emails').select('*, suppliers(name)').eq('booking_id', bookingId).order('created_at', { ascending: false }),
      supabase.from('booking_items').select('*').eq('booking_id', bookingId).order('sort_order').order('start_date'),
    ]);

    const b = bRes.data as Booking;
    setBooking(b);
    setLogs(lRes.data || []);
    setEmails(eRes.data || []);
    setItems((iRes.data || []) as BookingItem[]);

    if (b && b.proposals?.enquiry_id) {
      const { data: enqData } = await supabase
        .from('website_enquiries')
        .select('*')
        .eq('id', b.proposals.enquiry_id)
        .single();
      setEnquiry(enqData);
    } else {
      setEnquiry(null);
    }

    try {
      const [detailsRes, voucherRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}/details`),
        fetch(`/api/bookings/${bookingId}/vouchers`),
      ]);
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        setPackages(detailsData.packages || []);
        setPaymentAccounts(detailsData.paymentAccounts || []);
      }
      if (voucherRes.ok) {
        setVouchers(await voucherRes.json());
      }
      const { data: members } = await supabase
        .from('users')
        .select('id, full_name, role, email')
        .in('role', ['manager', 'super_admin', 'accounts'])
        .order('full_name');
      setTeamMembers(members || []);
    } catch (e) {
      console.error(e);
    }

    setLoading(false);
  }, [supabase, bookingId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateBooking = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookingId, ...updates }),
      });
      if (res.ok) {
        toast.success('Booking updated');
        await fetchAll();
      } else {
        toast.error('Failed to update booking');
      }
    } catch {
      toast.error('Failed to update booking');
    }
    setSaving(false);
  };

  const updateItem = async (itemId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, ...updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to update item');
        return;
      }
      if (updates.supplier_status) {
        toast.success(`Status updated to ${updates.supplier_status}`);
      }
      await fetchAll();
    } catch {
      toast.error('Failed to update item');
    }
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/bookings/${bookingId}/items?item_id=${itemId}`, { method: 'DELETE' });
    await fetchAll();
  };

  const generateVoucher = async (item: BookingItem, sendEmail = false) => {
    if (!booking) return;
    setGeneratingVoucher(item.id);

    const totalCost = Number(booking.cost_price);
    let totalPaidPkg = 0;
    if (packages.length > 0) {
      totalPaidPkg = packages.reduce((sum, pkg) =>
        sum + (pkg.payments || [])
          .filter((p) => p.status === 'paid')
          .reduce((s, p) => s + Number(p.amount_paid || 0), 0)
      , 0);
    } else {
      const allConfirmed = (items || []).length > 0 && (items || []).every(
        (bi: BookingItem) => bi.supplier_status === 'confirmed'
      );
      if (allConfirmed) {
        totalPaidPkg = totalCost;
      } else {
        totalPaidPkg = (items || [])
          .filter((bi: BookingItem) => bi.supplier_status === 'confirmed')
          .reduce((s: number, bi: BookingItem) => s + Number(bi.cost_price || 0), 0);
      }
    }
    const isFullyPaid = totalPaidPkg >= totalCost && totalCost > 0;
    const voucherStatus = isFullyPaid ? 'confirmed' : 'blocked';

    const details = item.details as Record<string, unknown>;
    const clientName = booking.clients?.full_name || 'Guest';
    const confirmationRef = item.supplier_reference || '';

    let supplierType = '';
    let content: Record<string, unknown> = {};

    switch (item.item_type) {
      case 'hotel_room':
        supplierType = 'hotel';
        content = {
          customerName: clientName,
          hotelName: (details.hotel_name as string) || item.label,
          checkInDate: (details.check_in as string) || item.start_date || '',
          checkOutDate: (details.check_out as string) || item.end_date || '',
          checkInTime: (details.check_in_time as string) || '',
          checkOutTime: (details.check_out_time as string) || '',
          roomType: (details.room_type as string) || '',
          numberOfRooms: (details.number_of_rooms as number) || undefined,
          guestNames: (details.guest_names as string[]) || [],
          mealPlan: (details.meal_plan as string) || '',
          confirmationNumber: confirmationRef,
          hotelSupportPhone: (details.hotel_support_phone as string) || '',
          specialRequests: item.supplier_notes || '',
        };
        break;
      case 'flight_segment':
        supplierType = 'flight';
        content = {
          customerName: clientName,
          airline: (details.airline as string) || '',
          flightNumber: (details.flight_number as string) || '',
          route: `${(details.departure_city as string) || ''} → ${(details.arrival_city as string) || ''}`,
          departureTime: (details.departure_datetime as string) || (details.departure_date as string) || item.start_date || '',
          arrivalTime: (details.arrival_datetime as string) || (details.arrival_date as string) || item.end_date || '',
          confirmationNumber: confirmationRef,
        };
        break;
      case 'vehicle':
        supplierType = 'vehicle';
        content = {
          customerName: clientName,
          vehicleBrand: (details.vehicle_brand as string) || '',
          vehicleType: (details.vehicle_type as string) || '',
          pickupLocation: (details.pickup_location as string) || '',
          dropoffLocation: (details.dropoff_location as string) || '',
          pickupDatetime: (details.pickup_datetime as string) || item.start_date || '',
          dropoffDatetime: (details.dropoff_datetime as string) || item.end_date || '',
          availabilityMode: (details.availability_type as string) || '',
          dailyHours: (details.daily_start_time as string) && (details.daily_end_time as string)
            ? `${details.daily_start_time} – ${details.daily_end_time}`
            : '',
          driverName: (details.driver_name as string) || ((item as unknown as Record<string, unknown>).driver_name as string) || '',
          confirmationNumber: confirmationRef,
          itinerary: (details.itinerary as Array<Record<string, string>>) || [],
        };
        break;
      case 'transfer':
        supplierType = 'transfer';
        content = {
          customerName: clientName,
          pickupTime: item.start_date || '',
          pickupLocation: (details.pickup_location as string) || (details.description as string) || '',
          dropoffLocation: (details.dropoff_location as string) || '',
          vehicleType: (details.vehicle_type as string) || '',
          serviceProviderName: (details.service_provider_name as string) || '',
          serviceProviderContact: (details.service_provider_contact as string) || '',
          driverName: (details.driver_name as string) || '',
          driverContact: (details.driver_contact as string) || '',
          confirmationNumber: confirmationRef,
        };
        break;
      case 'activity':
      default:
        supplierType = 'activity';
        content = {
          customerName: clientName,
          activityName: (details.description as string) || item.label,
          activityDate: item.start_date || '',
          confirmationNumber: confirmationRef,
        };
        break;
    }

    try {
      const res = await fetch(`/api/bookings/${bookingId}/vouchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_type: supplierType,
          content,
          voucher_status: voucherStatus,
          send_email: sendEmail,
          email_to: booking.clients?.email || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate voucher');
      }

      toast.success(sendEmail ? 'Voucher generated & emailed' : 'Voucher generated');
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate voucher');
      console.error(error);
    } finally {
      setGeneratingVoucher(null);
    }
  };

  return (
    <BookingContext.Provider
      value={{
        bookingId,
        booking,
        items,
        packages,
        paymentAccounts,
        vouchers,
        logs,
        emails,
        teamMembers,
        enquiry,
        loading,
        saving,
        generatingVoucher,
        fetchAll,
        updateBooking,
        updateItem,
        deleteItem,
        generateVoucher,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
