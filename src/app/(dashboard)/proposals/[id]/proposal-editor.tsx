'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, Hotel, Flight, ItineraryDay, LineItem, Supplier, User } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Save, Upload, Undo2, Eye, ArrowLeft, ArrowRight, AlertTriangle, History, Plus, Trash2, Sparkles, Search, ChevronRight, Download, Share2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';


import { applyRounding, formatCurrency } from '@/lib/utils/pricing';
import { prepareForExport } from '@/lib/utils/export';
import { CoverPageSection } from './sections/cover-page';
import { TripSummarySection } from './sections/trip-summary';
import { HotelsSection } from './sections/hotels';
import { FlightsSection } from './sections/flights';
import { ItinerarySection } from './sections/itinerary';
import { AncillariesSection } from './sections/ancillaries';
import { InclusionsExclusionsSection } from './sections/inclusions-exclusions';
import { CancellationPolicySection } from './sections/cancellation-policy';
import { PaymentTermsSection } from './sections/payment-terms';
import { CommentsSection } from './sections/comments';
import { ConvertToBookingButton } from '@/components/convert-to-booking-button';
import { AIAutoFillModal } from '@/components/proposals/AIAutoFillModal';
import { FlightSearchModal } from '@/components/proposals/FlightSearchModal';

interface CustomSection {
  id: string;
  title: string;
  content: string;
}

export interface ProposalFormValues {
  proposal: Proposal;
  hotels: Hotel[];
  flights: Flight[];
  itineraryDays: ItineraryDay[];
  lineItems: LineItem[];
  customSections: CustomSection[];
  includeFlights: boolean;
  globalMarkupPct: number;
  pricingMode: 'package' | 'itemised';
  landMarkupPct: number;
  flightMarkupPct: number;
  gstAmountOverride: number | null;
  tcsAmountOverride: number | null;
}

interface ProposalEditorProps {
  proposal: Proposal;
  hotels: Hotel[];
  flights: Flight[];
  itineraryDays: ItineraryDay[];
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
  lineItems: initialLineItems,
  suppliers,
  comments: initialComments,
  versions,
  currentUser,
}: ProposalEditorProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ── Form State (replaces all data useState) ──────────────────
  const draftInit = (initialProposal.draft_data || {}) as Record<string, unknown>;

  const form = useForm<ProposalFormValues>({
    defaultValues: {
      proposal: initialProposal,
      hotels: initialHotels,
      flights: initialFlights,
      itineraryDays: initialDays,
      lineItems: initialLineItems,
      customSections: (draftInit.custom_sections as CustomSection[]) || [],
      includeFlights: draftInit.include_flights !== false,
      globalMarkupPct: (draftInit.global_markup_pct as number) || 15,
      pricingMode: (draftInit.pricing_mode as 'package' | 'itemised') || 'package',
      landMarkupPct: (draftInit.land_markup_pct as number) ?? 15,
      flightMarkupPct: (draftInit.flight_markup_pct as number) ?? 5,
      gstAmountOverride: (draftInit.gst_amount_override as number) ?? null,
      tcsAmountOverride: (draftInit.tcs_amount_override as number) ?? null,
    },
  });

  const { watch, setValue, getValues, register } = form;

  // Watched values for pricing bar + section props
  const proposal = watch('proposal');
  const hotels = watch('hotels');
  const flights = watch('flights');
  const lineItems = watch('lineItems');
  const includeFlights = watch('includeFlights');
  const globalMarkupPct = Number(watch('globalMarkupPct')) || 0;
  const customSections = watch('customSections');
  const pricingMode = watch('pricingMode');
  const landMarkupPct = Number(watch('landMarkupPct')) || 0;
  const flightMarkupPct = Number(watch('flightMarkupPct')) || 0;
  const gstAmountOverride = watch('gstAmountOverride');
  const tcsAmountOverride = watch('tcsAmountOverride');

  // ── UI-only state (not in form) ──────────────────────────────
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [showInternalCosts, setShowInternalCosts] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enquiry, setEnquiry] = useState<any | null>(null);

  useEffect(() => {
    const enquiryId = (proposal as { enquiry_id?: string | null }).enquiry_id;
    if (enquiryId) {
      supabase
        .from('website_enquiries')
        .select('*')
        .eq('id', enquiryId)
        .single()
        .then(({ data }) => {
          if (data) setEnquiry(data);
        });
    }
  }, [proposal, supabase]);

  // Stepper navigation
  const [activeSection, setActiveSection] = useState<number>(0);
  
  const SECTIONS = [
    { id: 'cover', title: 'Cover Page' },
    { id: 'summary', title: 'Trip Summary' },
    { id: 'hotels', title: 'Accommodations' },
    { id: 'flights', title: 'Flights' },
    { id: 'ancillaries', title: 'Land Services & Package Pricing' },
    { id: 'itinerary', title: 'Itinerary' },
    { id: 'inclusions', title: 'Inclusions / Exclusions' },
    { id: 'custom', title: 'Custom Sections' },
    { id: 'cancellation', title: 'Cancellation Policy' },
    { id: 'payment', title: 'Payment Terms' },
    { id: 'comments', title: 'Comments' },
  ];

  // Modal states
  const [showAIAutoFill, setShowAIAutoFill] = useState(false);
  const [showFlightSearch, setShowFlightSearch] = useState(false);

  const hasDraft = proposal.draft_differs_from_published;
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  // ── Pricing calculations ──────────────────────────────────
  const landSupplierCost = useMemo(() => {
    const hotelCost = hotels.reduce((s, h) => s + (Number(h.cp_per_night) || 0) * (Number(h.nights) || 1), 0);
    const serviceCost = lineItems
      .filter(li => li.type === 'ancillary' && li.include_in_total)
      .reduce((s, li) => s + (Number(li.cp) || 0), 0);
    return hotelCost + serviceCost;
  }, [hotels, lineItems]);

  const flightSupplierCost = useMemo(() => {
    return includeFlights ? flights.reduce((s, f) => s + (Number(f.cp_total) || 0), 0) : 0;
  }, [flights, includeFlights]);

  const totalSupplierCost = landSupplierCost + flightSupplierCost;

  const pricingBreakdown = useMemo(() => {
    let landSalePrice: number;
    let flightSalePrice: number;

    if (pricingMode === 'itemised') {
      landSalePrice = landSupplierCost * (1 + landMarkupPct / 100);
      flightSalePrice = flightSupplierCost * (1 + flightMarkupPct / 100);
    } else {
      const combined = totalSupplierCost * (1 + globalMarkupPct / 100);
      landSalePrice = totalSupplierCost > 0 ? combined * (landSupplierCost / totalSupplierCost) : 0;
      flightSalePrice = totalSupplierCost > 0 ? combined * (flightSupplierCost / totalSupplierCost) : 0;
    }

    const subtotal = landSalePrice + flightSalePrice;
    const discount = Number(proposal.discount_amount) || 0;
    const afterDiscount = subtotal - discount;

    // GST: use override amount if set, otherwise calculate from rate. 0 if disabled.
    const safeGstOverride = gstAmountOverride !== null && Number.isFinite(Number(gstAmountOverride)) ? Number(gstAmountOverride) : null;
    const gstAmt = !proposal.gst_enabled ? 0
      : safeGstOverride !== null ? safeGstOverride
      : afterDiscount * (Number(proposal.gst_rate) || 0) / 100;

    // TCS: use override amount if set, otherwise calculate from rate. 0 if disabled.
    const safeTcsOverride = tcsAmountOverride !== null && Number.isFinite(Number(tcsAmountOverride)) ? Number(tcsAmountOverride) : null;
    const tcsAmt = !proposal.tcs_enabled ? 0
      : safeTcsOverride !== null ? safeTcsOverride
      : (afterDiscount + gstAmt) * (Number(proposal.tcs_rate) || 0) / 100;

    const raw = afterDiscount + gstAmt + tcsAmt;
    const clientTotal = applyRounding(raw, Number(proposal.rounding_unit) || Number(currentUser.rounding_unit) || 0);

    return { landSalePrice, flightSalePrice, subtotal, afterDiscount, gstAmt, tcsAmt, clientTotal };
  }, [pricingMode, landSupplierCost, flightSupplierCost, totalSupplierCost, globalMarkupPct, landMarkupPct, flightMarkupPct, proposal, currentUser, gstAmountOverride, tcsAmountOverride]);

  const clientTotal = pricingBreakdown.clientTotal;

  // ── Close version history dropdown ────────────────────────
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

  // ── Draft save function ────────────────────────────────────
  const saveDraftRef = useRef<() => Promise<void>>();

  // Optimistic locking: remember the row version we loaded; refuse to save
  // over someone else's edits (another tab, another teammate).
  const lastKnownUpdatedAt = useRef<string | null>((initialProposal.updated_at as string) || null);
  const [saveConflict, setSaveConflict] = useState(false);

  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);

  const handleRestoreVersion = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Restore V${versionNumber} as your working copy? Your current unsaved edits will be replaced.`)) return;
    setRestoringVersion(versionId);
    try {
      const res = await fetch(`/api/proposals/${initialProposal.id}/restore-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to restore version');
        return;
      }
      window.location.reload();
    } catch {
      alert('Failed to restore version');
    } finally {
      setRestoringVersion(null);
    }
  };

  const saveDraft = useCallback(async () => {
    if (saveConflict) return;
    setSaving(true);

    const v = getValues();
    const draftData = {
      proposal: v.proposal,
      hotels: v.hotels,
      flights: v.flights,
      itineraryDays: v.itineraryDays,
      lineItems: v.lineItems,
      include_flights: v.includeFlights,
      custom_sections: v.customSections,
      global_markup_pct: v.globalMarkupPct,
      pricing_mode: v.pricingMode,
      land_markup_pct: v.landMarkupPct,
      flight_markup_pct: v.flightMarkupPct,
      gst_amount_override: v.gstAmountOverride,
      tcs_amount_override: v.tcsAmountOverride,
    };

    let query = supabase.from('proposals').update({
      draft_data: draftData,
      draft_differs_from_published: v.proposal.status !== 'draft',
      ...(v.proposal.status === 'draft' ? {
        title: v.proposal.title,
        destination: v.proposal.destination,
        travel_start: v.proposal.travel_start,
        travel_end: v.proposal.travel_end,
        pax_adults: v.proposal.pax_adults,
        pax_children: v.proposal.pax_children,
        children_ages: v.proposal.children_ages,
        currency: v.proposal.currency,
        special_notes: v.proposal.special_notes,
        dietary_notes: v.proposal.dietary_notes,
        gst_enabled: v.proposal.gst_enabled,
        gst_rate: v.proposal.gst_rate,
        tcs_enabled: v.proposal.tcs_enabled,
        tcs_rate: v.proposal.tcs_rate,
        rounding_unit: v.proposal.rounding_unit,
        discount_amount: v.proposal.discount_amount,
        discount_note: v.proposal.discount_note,
        cover_image_url: v.proposal.cover_image_url,
        cover_image_source: v.proposal.cover_image_source,
        payment_terms: v.proposal.payment_terms,
        visa_section_enabled: v.proposal.visa_section_enabled,
        quote_type: v.proposal.quote_type,
        package_cp_per_person: v.proposal.package_cp_per_person,
        package_sp_per_person: v.proposal.package_sp_per_person,
        package_cwb_sp: v.proposal.package_cwb_sp,
        package_cnb_sp: v.proposal.package_cnb_sp,
        land_cp: v.proposal.land_cp,
        land_sp: pricingBreakdown.landSalePrice || v.proposal.land_sp,
        pricing_display_mode: v.proposal.pricing_display_mode,
        total_sp: clientTotal,
        trip_cities: v.proposal.trip_cities,
      } : {}),
    }).eq('id', v.proposal.id);
    if (lastKnownUpdatedAt.current) {
      query = query.eq('updated_at', lastKnownUpdatedAt.current);
    }
    const { data: savedRows } = await query.select('updated_at');

    if (!savedRows || savedRows.length === 0) {
      // Row changed under us — someone else saved since we loaded.
      setSaveConflict(true);
      setSaving(false);
      return;
    }
    lastKnownUpdatedAt.current = savedRows[0].updated_at as string;

    setSaving(false);
  }, [getValues, supabase, clientTotal, pricingBreakdown, saveConflict]);

  saveDraftRef.current = saveDraft;

  // ── Debounced auto-save on any form change ─────────────────
  const debouncedSaveTimer = useRef<NodeJS.Timeout>();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);

  useEffect(() => {
    const subscription = watch(() => {
      if (!mounted.current) return;
      if (debouncedSaveTimer.current) clearTimeout(debouncedSaveTimer.current);
      debouncedSaveTimer.current = setTimeout(() => {
        saveDraftRef.current?.();
      }, 3000);
    });
    return () => {
      subscription.unsubscribe();
      if (debouncedSaveTimer.current) clearTimeout(debouncedSaveTimer.current);
    };
  }, [watch]);

  // ── Helpers for child sections ─────────────────────────────
  const updateProposal = useCallback((updates: Partial<Proposal>) => {
    const current = getValues('proposal');
    setValue('proposal', { ...current, ...updates }, { shouldDirty: true });
  }, [getValues, setValue]);

  const setHotels = useCallback((h: Hotel[]) => {
    setValue('hotels', h, { shouldDirty: true });
  }, [setValue]);

  const setFlights = useCallback((f: Flight[]) => {
    setValue('flights', f, { shouldDirty: true });
  }, [setValue]);

  const setItineraryDays = useCallback((d: ItineraryDay[]) => {
    setValue('itineraryDays', d, { shouldDirty: true });
  }, [setValue]);

  const setLineItems = useCallback((li: LineItem[]) => {
    setValue('lineItems', li, { shouldDirty: true });
  }, [setValue]);

  // Custom sections helpers
  function addCustomSection() {
    const current = getValues('customSections');
    setValue('customSections', [...current, { id: crypto.randomUUID(), title: '', content: '' }], { shouldDirty: true });
  }

  function removeCustomSection(index: number) {
    const current = getValues('customSections');
    setValue('customSections', current.filter((_, i) => i !== index), { shouldDirty: true });
  }

  async function handlePublish() {
    setSaving(true);

    await fetch(`/api/proposals/${proposal.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    setSaving(false);
    toast.success('Proposal published and sent to the guest.');
    router.push('/proposals');
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exportPayload = prepareForExport({ hotels: hotels as any, flights: flights as any, lineItems: lineItems as any });
    console.log('[PDF Export] Cleaned payload ready:', exportPayload);
    const url = `/api/proposals/${proposal.id}/pdf${type ? `?type=${type}` : ''}`;
    window.open(url, '_blank');
  }

  const currency = proposal.currency || 'INR';

  return (
    <FormProvider {...form}>
      <div className="space-y-4 w-full max-w-none pb-24">
        {saveConflict && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This proposal was modified elsewhere (another tab or teammate). Auto-save is paused so nothing gets overwritten.
            </span>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload latest
            </Button>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
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
                    <div className="px-3 py-2 flex items-center justify-between bg-blue-50">
                      <div>
                        <span className="text-sm font-medium">V{proposal.version}</span>
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Current</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {proposal.updated_at ? new Date(proposal.updated_at as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </div>
                    {versions.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">No previous versions</p>
                    ) : (
                      versions.map((v) => {
                        const snap = v.snapshot as { proposal?: { total_sp?: number; currency?: string } } | null;
                        const snapTotal = snap?.proposal?.total_sp;
                        return (
                          <div key={v.id as string} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/50 border-t">
                            <div className="min-w-0">
                              <span className="text-sm font-medium">V{v.version as number}</span>
                              {snapTotal != null && (
                                <span className="ml-2 text-xs text-muted-foreground">{formatCurrency(Number(snapTotal), snap?.proposal?.currency)}</span>
                              )}
                              <span className="block text-xs text-muted-foreground">
                                {v.published_at ? new Date(v.published_at as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </span>
                            </div>
                            <button
                              className="text-xs text-blue-600 hover:underline shrink-0 disabled:opacity-50"
                              disabled={restoringVersion !== null}
                              onClick={() => handleRestoreVersion(v.id as string, v.version as number)}
                            >
                              {restoringVersion === (v.id as string) ? 'Restoring…' : 'Restore'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">

            <Button variant="outline" size="sm" onClick={() => setShowAIAutoFill(true)}>
              <Sparkles className="h-4 w-4 mr-1" /> AI Auto-Fill
            </Button>
            {/* Download/Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-8">
                <Download className="h-4 w-4 mr-2" /> Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleGeneratePdf()}>
                  PDF (Full Proposal)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGeneratePdf('hotel_only')}>
                  PDF (Hotels Only)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGeneratePdf('flight_only')}>
                  PDF (Flights Only)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Share Dropdown */}
            {shareUrl && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-8">
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.open(`/proposals/${proposal.id}/preview`, '_blank')}>
                    Preview Client View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success('Share link copied to clipboard');
                  }}>
                    Copy Share Link
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-green-600 font-medium" onClick={() => {
                    const text = `Hi! Here's your travel proposal for ${proposal.destination || 'your trip'}:\n${shareUrl}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}>
                    Send via WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!shareUrl && (
              <Button variant="outline" size="sm" onClick={() => window.open(`/proposals/${proposal.id}/preview`, '_blank')}>
                <Eye className="h-4 w-4 mr-2" /> Preview
              </Button>
            )}

            <div className="h-6 w-px bg-border mx-1" />

            {/* Editor Actions */}
            <Button variant="ghost" size="sm" onClick={saveDraft} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Save Draft
            </Button>
            {hasDraft && (
              <Button variant="ghost" size="sm" onClick={handleDiscard} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Undo2 className="h-4 w-4 mr-2" /> Discard
              </Button>
            )}
            
            <ConvertToBookingButton proposal={proposal} clientId={proposal.client_id || ''} />
            <Button size="sm" onClick={handlePublish} disabled={saving}>
              <Upload className="h-4 w-4 mr-2" />
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

        {enquiry?.requirement_details && (
          <div className="border border-blue-200 bg-blue-50/50 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-blue-900">Original Website Enquiry Preferences</h4>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                    {enquiry.requirement_details.is_pilgrimage ? 'Pilgrimage Lead' : 'Holiday Lead'}
                  </span>
                </div>
                <div className="text-xs text-blue-800 space-y-1">
                  <p>
                    <span className="font-semibold">Client Name:</span> {enquiry.name} &bull;{' '}
                    <span className="font-semibold">WhatsApp:</span> {enquiry.phone} &bull;{' '}
                    <span className="font-semibold">Origin Hub:</span> {enquiry.requirement_details.departure_city || 'Not specified'}
                  </p>
                  <p>
                    <span className="font-semibold">Planned Timeline:</span> {enquiry.travel_date || enquiry.requirement_details.travel_month || 'Flexible'} &bull;{' '}
                    <span className="font-semibold">Duration:</span> {enquiry.number_of_nights || enquiry.requirement_details.duration_nights || 'Flexible'} Night(s) &bull;{' '}
                    <span className="font-semibold">Pax:</span> {enquiry.adults || 1} Adult(s) {enquiry.children > 0 ? `, ${enquiry.children} Child(ren)` : ''}
                  </p>
                  {Array.isArray(enquiry.requirement_details.cities) && enquiry.requirement_details.cities.length > 0 && (
                    <p>
                      <span className="font-semibold">
                        {enquiry.requirement_details.is_pilgrimage ? 'Sites/Shrines Chosen:' : 'Cities/Regions Chosen:'}
                      </span>{' '}
                      {enquiry.requirement_details.cities.join(', ')}
                    </p>
                  )}
                  {Array.isArray(enquiry.requirement_details.special_services) && enquiry.requirement_details.special_services.length > 0 && (
                    <p>
                      <span className="font-semibold">Special Services Requested:</span>{' '}
                      <span className="underline decoration-amber-500 font-medium">
                        {enquiry.requirement_details.special_services.join(', ')}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SIDEBAR STEPPER BUILDER ─────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left Sidebar */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="sticky top-24 space-y-1 bg-white p-4 border border-border rounded-xl shadow-sm">
              <h3 className="font-semibold text-sm mb-3 px-2 text-muted-foreground uppercase tracking-wider">Proposal Builder</h3>
              {SECTIONS.map((sec, i) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveSection(i);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-between ${activeSection === i ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  {sec.title}
                  {activeSection === i && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">{SECTIONS[activeSection].title}</h2>
                {/* Specific header controls based on section */}
                {activeSection === 2 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-muted-foreground">Show Costs & Suppliers</span>
                    <input
                      type="checkbox"
                      checked={showInternalCosts}
                      onChange={(e) => setShowInternalCosts(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
                    />
                  </label>
                )}
                {activeSection === 3 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm font-medium">Include Flights</span>
                    <input
                      type="checkbox"
                      checked={includeFlights}
                      onChange={(e) => setValue('includeFlights', e.target.checked, { shouldDirty: true })}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                  </label>
                )}
              </div>
              
              <div className="p-6 min-h-[400px]">
                {activeSection === 0 && (
                  <CoverPageSection proposal={proposal} updateProposal={updateProposal} />
                )}
                {activeSection === 1 && (
                  <TripSummarySection proposal={proposal} updateProposal={updateProposal} setHotels={setHotels} />
                )}
                {activeSection === 2 && (
                  <HotelsSection
                    proposal={proposal}
                    hotels={hotels}
                    setHotels={setHotels}
                    suppliers={suppliers}
                    showInternalCosts={showInternalCosts}
                  />
                )}
                {activeSection === 3 && (
                  <>
                    <div className={includeFlights ? '' : 'hidden'}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                            <p className="text-sm text-muted-foreground">Upload Screenshot (Vision AI)</p>
                            <p className="text-xs text-muted-foreground mt-1">Drop a screenshot of flight details here to auto-fill</p>
                          </div>
                          <div className="flex items-center justify-center">
                            <Button type="button" variant="outline" onClick={() => setShowFlightSearch(true)}>
                              <Search className="h-4 w-4 mr-2" /> Search Live Flights
                            </Button>
                          </div>
                        </div>
                        <FlightsSection
                          proposal={proposal}
                          flights={flights}
                          setFlights={setFlights}
                          suppliers={suppliers}
                        />
                        <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                          Note: Flight fares are dynamic and subject to change daily.
                        </p>
                      </div>
                    </div>
                    {!includeFlights && (
                      <p className="text-sm text-muted-foreground py-4 text-center">Flights are excluded from this proposal. Toggle above to include.</p>
                    )}
                  </>
                )}
                {activeSection === 4 && (
                  <AncillariesSection
                    proposalId={proposal.id}
                    lineItems={lineItems}
                    setLineItems={setLineItems}
                    suppliers={suppliers}
                    paxAdults={proposal.pax_adults || 2}
                    paxChildren={proposal.pax_children || 0}
                  />
                )}
                {activeSection === 5 && (
                  <ItinerarySection
                    proposal={proposal}
                    itineraryDays={watch('itineraryDays')}
                    setItineraryDays={setItineraryDays}
                    hotels={hotels}
                    flights={flights}
                  />
                )}
                {activeSection === 6 && (
                  <InclusionsExclusionsSection
                    proposalId={proposal.id}
                    lineItems={lineItems}
                    setLineItems={setLineItems}
                  />
                )}
                {activeSection === 7 && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button type="button" size="sm" variant="outline" onClick={addCustomSection}>
                        <Plus className="h-4 w-4 mr-1" /> Add Custom Section
                      </Button>
                    </div>
                    {customSections.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No custom sections yet. Add sections for Cancellation Policy, Terms & Conditions, Notes, etc.
                      </p>
                    )}
                    {customSections.map((section, index) => (
                      <div key={section.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Input
                            {...register(`customSections.${index}.title`)}
                            placeholder="Section title (e.g. Cancellation Policy, Terms & Conditions)"
                            className="flex-1 font-medium"
                          />
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeCustomSection(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <Textarea
                          {...register(`customSections.${index}.content`)}
                          placeholder="Enter section content..."
                          rows={4}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {activeSection === 8 && (
                  <CancellationPolicySection
                    proposal={proposal}
                    updateProposal={updateProposal}
                    hotels={hotels}
                    flights={flights}
                  />
                )}
                {activeSection === 9 && (
                  <PaymentTermsSection
                    proposal={proposal}
                    updateProposal={updateProposal}
                    currentUser={currentUser}
                  />
                )}
                {activeSection === 10 && (
                  <CommentsSection
                    proposalId={proposal.id}
                    comments={comments}
                    setComments={setComments}
                    currentUser={currentUser}
                  />
                )}
              </div>

              {/* Next Button Footer */}
              {activeSection < SECTIONS.length - 1 && (
                <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
                  <Button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveSection(activeSection + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Next: {SECTIONS[activeSection + 1].title} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── END-OF-BUILDER ACTIONS ─────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 py-6 pb-28">
          <Button variant="outline" size="default" onClick={() => window.open(`/proposals/${proposal.id}/preview`, '_blank')}>
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button size="default" onClick={handlePublish} disabled={saving}>
            <Upload className="h-4 w-4 mr-2" />
            {proposal.status === 'draft' ? 'Publish & Send' : `Publish V${proposal.version + 1}`}
          </Button>
        </div>

        {/* ── GLOBAL PRICING BAR (sticky bottom) ──────────────────── */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40 bg-background border-t shadow-lg">
          <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
            {/* Mode toggle */}
            <div className="inline-flex rounded-md border bg-muted p-0.5 shrink-0">
              <button
                type="button"
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${pricingMode === 'package' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setValue('pricingMode', 'package', { shouldDirty: true })}
              >
                Package
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${pricingMode === 'itemised' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setValue('pricingMode', 'itemised', { shouldDirty: true })}
              >
                Itemised
              </button>
            </div>

            {/* Pricing calculation */}
            {pricingMode === 'package' ? (
              <div className="flex items-center gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs block">Supplier Cost</span>
                  <span className="font-bold text-sm">{formatCurrency(totalSupplierCost, currency)}</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={watch('globalMarkupPct') ?? ''}
                    onChange={(e) => setValue('globalMarkupPct', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0, { shouldDirty: true })}
                    className="w-16 h-7 text-xs text-center"
                  />
                  <span className="text-xs">%</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div>
                  <span className="text-muted-foreground text-xs block">Client Total</span>
                  <span className="font-bold text-sm text-green-700">{formatCurrency(clientTotal, currency)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded">
                  <span className="text-[10px] text-muted-foreground">Land</span>
                  <span className="text-xs font-semibold">{formatCurrency(landSupplierCost, currency)}</span>
                  <span className="text-muted-foreground text-[10px]">+</span>
                  <Input type="number" min={0} max={100} value={watch('landMarkupPct') ?? ''} onChange={(e) => setValue('landMarkupPct', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0, { shouldDirty: true })} className="w-12 h-6 text-[11px] text-center" />
                  <span className="text-[10px]">%</span>
                  <span className="text-muted-foreground text-[10px]">=</span>
                  <span className="text-xs font-semibold text-blue-700">{formatCurrency(pricingBreakdown.landSalePrice, currency)}</span>
                </div>
                <span className="text-muted-foreground font-bold text-xs">+</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 rounded">
                  <span className="text-[10px] text-muted-foreground">Flight</span>
                  <span className="text-xs font-semibold">{formatCurrency(flightSupplierCost, currency)}</span>
                  <span className="text-muted-foreground text-[10px]">+</span>
                  <Input type="number" min={0} max={100} value={watch('flightMarkupPct') ?? ''} onChange={(e) => setValue('flightMarkupPct', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0, { shouldDirty: true })} className="w-12 h-6 text-[11px] text-center" />
                  <span className="text-[10px]">%</span>
                  <span className="text-muted-foreground text-[10px]">=</span>
                  <span className="text-xs font-semibold text-amber-700">{formatCurrency(pricingBreakdown.flightSalePrice, currency)}</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold text-sm text-green-700">{formatCurrency(clientTotal, currency)}</span>
              </div>
            )}

            {/* GST / TCS + Margin */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={proposal.gst_enabled}
                  onChange={(e) => {
                    updateProposal({ gst_enabled: e.target.checked });
                    if (!e.target.checked) setValue('gstAmountOverride', null, { shouldDirty: true });
                  }}
                  className="h-3 w-3 rounded border-gray-300 accent-primary"
                />
                <span className="text-[11px] font-medium">GST</span>
              </label>
              {proposal.gst_enabled && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min={0} max={100} step="0.1"
                    value={proposal.gst_rate ?? ''}
                    onChange={(e) => { updateProposal({ gst_rate: Number(e.target.value) }); setValue('gstAmountOverride', null, { shouldDirty: true }); }}
                    className="w-12 h-6 text-[11px] text-center"
                  />
                  <span className="text-[10px]">%</span>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <Input
                    type="number" min={0} step="1" placeholder="₹"
                    value={gstAmountOverride ?? ''}
                    onChange={(e) => setValue('gstAmountOverride', e.target.value ? Number(e.target.value) : null, { shouldDirty: true })}
                    className="w-16 h-6 text-[11px] text-center"
                  />
                </div>
              )}

              <div className="h-4 w-px bg-border" />

              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={proposal.tcs_enabled}
                  onChange={(e) => {
                    updateProposal({ tcs_enabled: e.target.checked });
                    if (!e.target.checked) setValue('tcsAmountOverride', null, { shouldDirty: true });
                  }}
                  className="h-3 w-3 rounded border-gray-300 accent-primary"
                />
                <span className="text-[11px] font-medium">TCS</span>
              </label>
              {proposal.tcs_enabled && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min={0} max={100} step="0.1"
                    value={proposal.tcs_rate ?? ''}
                    onChange={(e) => { updateProposal({ tcs_rate: Number(e.target.value) }); setValue('tcsAmountOverride', null, { shouldDirty: true }); }}
                    className="w-12 h-6 text-[11px] text-center"
                  />
                  <span className="text-[10px]">%</span>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <Input
                    type="number" min={0} step="1" placeholder="₹"
                    value={tcsAmountOverride ?? ''}
                    onChange={(e) => setValue('tcsAmountOverride', e.target.value ? Number(e.target.value) : null, { shouldDirty: true })}
                    className="w-16 h-6 text-[11px] text-center"
                  />
                </div>
              )}

              <div className="h-4 w-px bg-border" />
              <span className="text-[11px] text-muted-foreground">
                Margin: {formatCurrency(pricingBreakdown.afterDiscount - totalSupplierCost, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Modals */}
        <AIAutoFillModal
          open={showAIAutoFill}
          onClose={() => setShowAIAutoFill(false)}
          proposalId={proposal.id}
          onDataParsed={(parsed) => {
            if (parsed.destination) updateProposal({ destination: parsed.destination as string });
            if (parsed.travel_start) updateProposal({ travel_start: parsed.travel_start as string });
            if (parsed.travel_end) updateProposal({ travel_end: parsed.travel_end as string });
            if (parsed.pax_adults) updateProposal({ pax_adults: parsed.pax_adults as number });
            if (parsed.pax_children) updateProposal({ pax_children: parsed.pax_children as number });
          }}
        />
        <FlightSearchModal
          open={showFlightSearch}
          onClose={() => setShowFlightSearch(false)}
          currency={currency}
          onSelectFlight={(flight) => {
            const newFlight = {
              id: crypto.randomUUID(),
              proposal_id: proposal.id,
              flight_number: flight.flight_number,
              airline: flight.airline,
              origin: flight.origin,
              destination: flight.destination,
              departure_time: flight.departure_time,
              arrival_time: flight.arrival_time,
              sp_total: flight.sp_total,
              sort_order: flights.length,
            } as unknown as typeof flights[number];
            setFlights([...flights, newFlight]);
            toast.success(`Flight ${flight.flight_number} added`);
          }}
        />
      </div>
    </FormProvider>
  );
}
