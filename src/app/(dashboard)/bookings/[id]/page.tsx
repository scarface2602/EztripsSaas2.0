'use client';

import { useState, use } from 'react';
import { BookingProvider, useBooking } from './booking-context';
import { BookingHeader } from './components/booking-header';
import { BookingSummaryCards } from './components/booking-summary-cards';
import { BookingItemsTab } from './components/tabs/booking-items-tab';
import { BookingPaymentsTab } from './components/tabs/booking-payments-tab';
import { BookingFinancialsTab } from './components/tabs/booking-financials-tab';
import { BookingVouchersTab } from './components/tabs/booking-vouchers-tab';
import { BookingDetailsTab } from './components/tabs/booking-details-tab';
import { BookingEmailsTab } from './components/tabs/booking-emails-tab';
import { BookingLogsTab } from './components/tabs/booking-logs-tab';
import { BookingOperationsTab } from './components/tabs/booking-operations-tab';
import { BookingPassengers } from '@/components/booking-passengers';
import { Loader2, Package, IndianRupee, FileText, Ticket, User, Info, Mail, Activity, ArrowRightLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

function BookingPageInner() {
  const { booking, loading } = useBooking();
  const [activeTab, setActiveTab] = useState('items');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-2xl font-bold mb-2">Booking Not Found</h2>
        <p className="text-muted-foreground">The booking you are looking for does not exist or has been removed.</p>
      </div>
    );
  }

  const TABS = [
    { id: 'items', label: 'Items & Confirmations', icon: Package },
    { id: 'payments', label: 'Payments', icon: IndianRupee },
    { id: 'financials', label: 'Financials', icon: FileText },
    { id: 'vouchers', label: 'Vouchers', icon: Ticket },
    { id: 'details', label: 'Details', icon: Info },
    { id: 'passengers', label: 'Passengers', icon: User },
    { id: 'emails', label: 'Emails', icon: Mail },
    { id: 'logs', label: 'Activity Log', icon: Activity },
    { id: 'operations', label: 'Operations & ERP', icon: ArrowRightLeft },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <BookingHeader />
      <BookingSummaryCards />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Stepper Navigation */}
        <div className="md:col-span-1">
          <div className="sticky top-6 bg-card rounded-lg border shadow-sm p-2">
            <ScrollArea className="h-auto max-h-[80vh]">
              <nav className="space-y-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3">
          {activeTab === 'items' && <BookingItemsTab />}
          {activeTab === 'payments' && <BookingPaymentsTab />}
          {activeTab === 'financials' && <BookingFinancialsTab />}
          {activeTab === 'vouchers' && <BookingVouchersTab />}
          {activeTab === 'details' && <BookingDetailsTab />}
          {activeTab === 'passengers' && <BookingPassengers bookingId={booking.id} />}
          {activeTab === 'emails' && <BookingEmailsTab />}
          {activeTab === 'logs' && <BookingLogsTab />}
          {activeTab === 'operations' && <BookingOperationsTab />}
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <BookingProvider bookingId={id}>
      <BookingPageInner />
    </BookingProvider>
  );
}
