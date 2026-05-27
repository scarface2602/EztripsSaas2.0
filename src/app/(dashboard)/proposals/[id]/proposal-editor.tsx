'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, Hotel, Flight, ItineraryDay, ItineraryActivity, LineItem, Supplier, User } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Upload, Undo2, Eye, ArrowLeft, AlertTriangle, History, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

import { applyRounding } from '@/lib/utils/pricing';
import { CoverPageSection } from './sections/cover-page';
import { TripSummarySection } from './sections/trip-summary';
import { HotelsSection } from './sections/hotels';
import { FlightsSection } from './sections/flights';
import { ItinerarySection } from './sections/itinerary';
import { AncillariesSection } from './sections/ancillaries';
import { InclusionsExclusionsSection } from './sections/inclusions-exclusions';
import { PricingSummarySection } from './sections/pricing-summary';
import { CancellationPolicySection } from './sections/cancellation-policy';
import { PaymentTermsSection } from './sections/payment-terms';
import { CommentsSection } from './sections/comments';
import { ConvertToBookingButton } from '@/components/convert-to-booking-button';

interface ProposalEditorProps {
  proposal: Proposal;
  hotels: Hotel[];
  flights: Flight[];
  itineraryDays: ItineraryDay[];
  activities: ItineraryActivity[];
  lineItems: LineItem[];
  suppliers: Supplier[];
  comments: (Record<string, unknown>)[];
  versions: Record<string, unknown>[];
  currentUser: User;
}

export function ProposalEditor({
  proposal: initialProposal,
  hotels: initialHotels,
  flights: initialFlights,
  itineraryDays: initialDays,
  activities: initialActivities,
  lineItems: initialLineItems,
  suppliers,
  comments: initialComments,
  versions,
  currentUser,
}: ProposalEditorProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const autoSaveRef = useRef<NodeJS.Timeout>();
  const saveDraftRef = useRef<() => Promise<void>>();

  const [proposal, setProposal] = useState(initialProposal);
  const [hotels, setHotels] = useState(initialHotels);
  const [flights, setFlights] = useState(initialFlights);
  const [itineraryDays, setItineraryDays] = useState(initialDays);
  const [activities, setActivities] = useState(initialActivities);
  const [lineItems, setLineItems] = useState(initialLineItems);
  const [comments, setComments] = useState(initialComments);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [itineraryDirty, setItineraryDirty] = useState(false);
  const [activeTab, setActiveTab] = useState('cover');
  const [summaryValidationError, setSummaryValidationError] = useState<string | null>(null);

  const hasDraft = proposal.draft_differs_from_published;
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  // Close version history dropdown when clicking outside
  useEffect(() => {
    if (!showVersionHistory) return;
    function handleClickOutside(e: MouseEvent) {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(e.target as Node)) {
        setShowVersionHistory(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVersionHistory]);
  useEffect(() => {
    if (proposal.share_token) {
      setShareUrl(`${window.location.origin}/p/${proposal.share_token}`);
    }
  }, [proposal.share_token]);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    const draftData = {
      proposal,
      hotels,
      flights,
      itineraryDays,
      activities,
      lineItems,
    };

    await supabase.from('proposals').update({
      draft_data: draftData,
      draft_differs_from_published: proposal.status !== 'draft',
      // For draft proposals, update fields directly
      ...(proposal.status === 'draft' ? {
        title: proposal.title,
        destination: proposal.destination,
        travel_start: proposal.travel_start,
        travel_end: proposal.travel_end,
        pax_adults: proposal.pax_adults,
        pax_children: proposal.pax_children,
        children_ages: proposal.children_ages,
        currency: proposal.currency,
        special_notes: proposal.special_notes,
        dietary_notes: proposal.dietary_notes,
        gst_enabled: proposal.gst_enabled,
        gst_rate: proposal.gst_rate,
        tcs_enabled: proposal.tcs_enabled,
        tcs_rate: proposal.tcs_rate,
        rounding_unit: proposal.rounding_unit,
        discount_amount: proposal.discount_amount,
        discount_note: proposal.discount_note,
        cover_image_url: proposal.cover_image_url,
        cover_image_source: proposal.cover_image_source,
        payment_terms: proposal.payment_terms,
        visa_section_enabled: proposal.visa_section_enabled,
        quote_type: proposal.quote_type,
        package_cp_per_person: proposal.package_cp_per_person,
        package_sp_per_person: proposal.package_sp_per_person,
        package_cwb_sp: proposal.package_cwb_sp,
        package_cnb_sp: proposal.package_cnb_sp,
        land_cp: proposal.land_cp,
        land_sp: proposal.land_sp,
        pricing_display_mode: proposal.pricing_display_mode,
        total_sp: (() => {
          // Derive grand total from actual item SPs so the number is consistent
          // across all proposal types (land, itemised hotels, flights, mixed).
          const hotelSP = hotels
            .filter(h => (Number(h.sp_per_night) || 0) > 0)
            .reduce((s, h) => s + (Number(h.sp_per_night) || 0) * (Number(h.nights) || 1), 0);
          const flightSP = flights
            .reduce((s, f) => s + (Number(f.sp_total) || 0), 0);
          // Use itemised hotel SP when available, else fall back to manual land_sp
          const landSP = hotelSP > 0 ? hotelSP : Number(proposal.land_sp) || 0;
          const subtotal = landSP + flightSP;
          const discount = Number(proposal.discount_amount) || 0;
          const afterDiscount = subtotal - discount;
          const gstAmt = proposal.gst_enabled ? afterDiscount * (Number(proposal.gst_rate) || 5) / 100 : 0;
          const tcsAmt = proposal.tcs_enabled ? (afterDiscount + gstAmt) * (Number(proposal.tcs_rate) || 5) / 100 : 0;
          const raw = afterDiscount + gstAmt + tcsAmt;
          return applyRounding(raw, Number(proposal.rounding_unit) || Number(currentUser.rounding_unit) || 0);
        })(),
        trip_cities: proposal.trip_cities,
      } : {}),
    }).eq('id', proposal.id);

    setHasUnsavedChanges(false);
    setSaving(false);
  }, [proposal, hotels, flights, itineraryDays, activities, lineItems, supabase, currentUser]);

  // Keep ref in sync so the interval always calls the latest version
  saveDraftRef.current = saveDraft;

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    autoSaveRef.current = setInterval(() => {
      saveDraftRef.current?.();
    }, 30000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [hasUnsavedChanges]);

  function updateProposal(updates: Partial<Proposal>) {
    setProposal(prev => {
      const next = { ...prev, ...updates };
      // Clear validation error once the required fields are filled
      if (next.destination && next.travel_start && next.travel_end) {
        setSummaryValidationError(null);
      }
      return next;
    });
    setHasUnsavedChanges(true);
  }

  function handleTabChange(tab: string) {
    // Allow Cover and Summary tabs freely
    if (tab === 'cover' || tab === 'summary') {
      setActiveTab(tab);
      setSummaryValidationError(null);
      return;
    }
    // Validate required fields before leaving Summary
    const missing: string[] = [];
    if (!proposal.destination) missing.push('Destination');
    if (!proposal.travel_start) missing.push('Travel Start');
    if (!proposal.travel_end) missing.push('Travel End');
    if (missing.length > 0) {
      setSummaryValidationError(`Please fill in required fields before continuing: ${missing.join(', ')}`);
      setActiveTab('summary');
      return;
    }
    setSummaryValidationError(null);
    setActiveTab(tab);
  }

  async function handlePublish() {
    setSaving(true);

    await fetch(`/api/proposals/${proposal.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    router.refresh();
    setSaving(false);
  }

  async function handleDiscard() {
    if (!confirm('Discard all unpublished changes?')) return;
    await supabase.from('proposals').update({
      draft_data: null,
      draft_differs_from_published: false,
    }).eq('id', proposal.id);
    router.refresh();
  }

  async function handleGeneratePdf(type?: string) {
    const url = `/api/proposals/${proposal.id}/pdf${type ? `?type=${type}` : ''}`;
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-4 w-full max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/proposals')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">{proposal.title || 'Untitled Proposal'}</h1>
          <Badge className={
            proposal.status === 'confirmed' ? 'bg-green-100 text-green-700' :
            proposal.status === 'sent' ? 'bg-blue-100 text-blue-700' :
            proposal.status === 'viewed' ? 'bg-yellow-100 text-yellow-700' :
            proposal.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }>
            {proposal.status}
          </Badge>
          <div className="relative" ref={versionDropdownRef}>
            <button
              onClick={() => setShowVersionHistory(v => !v)}
              className="flex items-center gap-1 px-2 py-0.5 border rounded text-xs font-medium hover:bg-muted transition-colors"
              title="Version history"
            >
              <History className="h-3 w-3" />
              V{proposal.version}
              {versions.length > 0 && <span className="text-muted-foreground">({versions.length} prev)</span>}
            </button>
            {showVersionHistory && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-background border rounded-lg shadow-lg w-64 py-1">
                <div className="px-3 py-1.5 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Version History</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {/* Current version */}
                  <div className="px-3 py-2 flex items-center justify-between bg-blue-50">
                    <div>
                      <span className="text-sm font-medium">V{proposal.version}</span>
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Current</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {proposal.updated_at ? new Date(proposal.updated_at as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  {/* Previous versions */}
                  {versions.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">No previous versions</p>
                  ) : (
                    versions.map((v) => (
                      <div key={v.id as string} className="px-3 py-2 flex items-center justify-between hover:bg-muted/50 border-t">
                        <span className="text-sm font-medium">V{v.version as number}</span>
                        <span className="text-xs text-muted-foreground">
                          {v.published_at ? new Date(v.published_at as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
        </div>
        <div className="flex items-center gap-2">
          {proposal.status === 'confirmed' && (
            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={async () => {
              // Ensure bookings exist (idempotent — API rejects if already created)
              await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposal_id: proposal.id }),
              });
              router.push(`/bookings?proposal_id=${proposal.id}`);
            }}>
              <ClipboardList className="h-4 w-4 mr-1" /> View Bookings
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.open(`/proposals/${proposal.id}/preview`, '_blank')}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
          <ConvertToBookingButton proposal={proposal} clientId={proposal.client_id || ''} />
          {shareUrl && (
            <>
              <Button variant="outline" size="sm" onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Share link copied to clipboard');
              }}>
                <Eye className="h-4 w-4 mr-1" /> Copy Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-green-600 border-green-300 hover:bg-green-50"
                onClick={() => {
                  const text = `Hi! Here's your travel proposal for ${proposal.destination || 'your trip'}:\n${shareUrl}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
              >
                <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => handleGeneratePdf()}>PDF</Button>
          <Button variant="outline" size="sm" onClick={() => handleGeneratePdf('hotel_only')}>PDF (Hotels Only)</Button>
          <Button variant="outline" size="sm" onClick={() => handleGeneratePdf('flight_only')}>PDF (Flights Only)</Button>
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
          {hasDraft && (
            <Button variant="outline" size="sm" onClick={handleDiscard}>
              <Undo2 className="h-4 w-4 mr-1" /> Discard
            </Button>
          )}
          <Button size="sm" onClick={handlePublish} disabled={saving}>
            <Upload className="h-4 w-4 mr-1" />
            {proposal.status === 'draft' ? 'Publish & Send' : `Publish V${proposal.version + 1}`}
          </Button>
        </div>
      </div>

      {/* Unpublished changes banner */}
      {hasDraft && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-yellow-800">You have unpublished changes. The client still sees the previous version.</span>
        </div>
      )}

      {/* Section navigation + content — manual tab implementation to avoid
          the Tabs component's built-in flex layout which creates a 3-column look */}
      <div className="w-full">
        {/* Horizontal tab bar */}
        <div className="sticky top-0 z-10 flex flex-wrap gap-1 bg-muted p-1 rounded-lg">
          {([
            ['cover', 'Cover'],
            ['summary', 'Trip Summary'],
            ['hotels', 'Hotels'],
            ['flights', 'Flights'],
            ['ancillaries', 'Ancillaries'],
            ['itinerary', 'Itinerary'],
            ['inclusions', 'Incl/Excl'],
            ['pricing', 'Pricing'],
            ['cancellation', 'Cancellation'],
            ['payment', 'Payment'],
            ['comments', 'Comments'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeTab === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {key === 'itinerary' && itineraryDirty && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved itinerary changes" />
              )}
            </button>
          ))}
        </div>

        {/* Validation error banner */}
        {summaryValidationError && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm text-red-700">{summaryValidationError}</span>
          </div>
        )}

        {/* Section content — full width below tabs */}
        <div className="mt-4 w-full">
          {activeTab === 'cover' && (
            <CoverPageSection proposal={proposal} updateProposal={updateProposal} />
          )}
          {activeTab === 'summary' && (
            <TripSummarySection proposal={proposal} updateProposal={updateProposal} />
          )}
          {activeTab === 'hotels' && (
            <HotelsSection
              proposal={proposal}
              hotels={hotels}
              setHotels={setHotels}
              suppliers={suppliers}
              setHasUnsavedChanges={setHasUnsavedChanges}
            />
          )}
          {activeTab === 'flights' && (
            <FlightsSection
              proposal={proposal}
              flights={flights}
              setFlights={setFlights}
              suppliers={suppliers}
              setHasUnsavedChanges={setHasUnsavedChanges}
            />
          )}
          {activeTab === 'ancillaries' && (
            <AncillariesSection
              proposalId={proposal.id}
              lineItems={lineItems}
              setLineItems={setLineItems}
              suppliers={suppliers}
              setHasUnsavedChanges={setHasUnsavedChanges}
            />
          )}
          {activeTab === 'itinerary' && (
            <ItinerarySection
              proposal={proposal}
              itineraryDays={itineraryDays}
              setItineraryDays={setItineraryDays}
              activities={activities}
              setActivities={setActivities}
              hotels={hotels}
              flights={flights}
              suppliers={suppliers}
              setHasUnsavedChanges={setHasUnsavedChanges}
              onDirtyChange={setItineraryDirty}
            />
          )}
          {activeTab === 'inclusions' && (
            <InclusionsExclusionsSection
              proposalId={proposal.id}
              lineItems={lineItems}
              setLineItems={setLineItems}
              setHasUnsavedChanges={setHasUnsavedChanges}
            />
          )}
          {activeTab === 'pricing' && (
            <PricingSummarySection
              proposal={proposal}
              updateProposal={updateProposal}
              hotels={hotels}
              lineItems={lineItems}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'cancellation' && (
            <CancellationPolicySection
              proposal={proposal}
              updateProposal={updateProposal}
              hotels={hotels}
              flights={flights}
            />
          )}
          {activeTab === 'payment' && (
            <PaymentTermsSection
              proposal={proposal}
              updateProposal={updateProposal}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'comments' && (
            <CommentsSection
              proposalId={proposal.id}
              comments={comments}
              setComments={setComments}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>
    </div>
  );
}
