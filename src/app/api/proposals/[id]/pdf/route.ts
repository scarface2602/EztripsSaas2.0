import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { cleanText } from '@/lib/utils/text-sanitise';
import { getCurrencySymbol } from '@/lib/utils/pricing';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function urlToBase64DataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return '';
  }
}

/**
 * Title-case helper.
 * NEVER apply to airport/IATA codes — those must stay UPPERCASE.
 * NEVER apply to body text / descriptions.
 */
function toTitleCase(str: string): string {
  if (!str) return str;
  const minor = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'up', 'via', 'with']);
  return str.replace(/\S+/g, (word, offset) => {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (offset > 0 && minor.has(clean.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/** Format a date string as "DD MMM YYYY" */
function fmtDate(dt: string): string {
  if (!dt) return 'N/A';
  try {
    return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dt; }
}

/** Format a datetime string as "HH:MM" (24h) */
function fmtTime(dt: string): string {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
}

/** Convert currency symbol to a safe HTML representation. ₹ → &#8377; */
function htmlSym(symbol: string): string {
  if (symbol === '₹') return '&#8377;';
  return symbol;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const pdfType = searchParams.get('type') || 'full';

  const supabase = createServiceClient();

  const [
    { data: proposal },
    { data: hotels },
    { data: flights },
    { data: itineraryDays },
    { data: activities },
    { data: lineItems },
    { data: client },
    { data: user },
  ] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', id).single(),
    supabase.from('hotels').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', id).order('day_number'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('line_items').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('proposals').select('client_id').eq('id', id).single().then(async (r) => {
      if (r.data?.client_id) return supabase.from('clients').select('*').eq('id', r.data.client_id).single();
      return { data: null };
    }),
    supabase.from('proposals').select('created_by').eq('id', id).single().then(async (r) => {
      if (r.data?.created_by) return supabase.from('users').select('*').eq('id', r.data.created_by).single();
      return { data: null };
    }),
  ]);

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // FIX 3: Use HTML entity for ₹ to guarantee it renders in Puppeteer
  const rawSym = getCurrencySymbol(proposal.currency as string);
  const cur = htmlSym(rawSym);

  const agentUser = user as Record<string, unknown> | null;
  let org: Record<string, unknown> | null = null;
  if (agentUser?.org_id) {
    const { data: orgData } = await supabase
      .from('organisations').select('*').eq('id', agentUser.org_id as string).single();
    org = orgData;
  }

  const orgName     = (org?.name || agentUser?.agency_name || '') as string;
  const orgLogoUrl  = (org?.logo_url || agentUser?.logo_url || '') as string;
  const orgPhone    = (org?.phone || '') as string;
  const orgEmail    = (org?.email || agentUser?.email || '') as string;
  const orgWebsite  = (org?.website || '') as string;
  const agentName   = (agentUser?.full_name || '') as string;
  const agentEmail  = (agentUser?.email || '') as string;

  const [coverImageDataUri, orgLogoDataUri] = await Promise.all([
    proposal.cover_image_url ? urlToBase64DataUri(proposal.cover_image_url as string) : Promise.resolve(''),
    orgLogoUrl ? urlToBase64DataUri(orgLogoUrl) : Promise.resolve(''),
  ]);

  const optionalAddons = (activities || []).filter((a: Record<string, unknown>) => a.is_optional);
  const inclusions     = (lineItems || []).filter((li: Record<string, unknown>) => li.is_included && li.description);
  const exclusions     = (lineItems || []).filter((li: Record<string, unknown>) => !li.is_included && li.description);

  const showHotels      = pdfType !== 'flight_only';
  const showFlights     = pdfType !== 'hotel_only';
  const showItinerary   = pdfType === 'full';
  const showInclExcl    = pdfType === 'full';
  const showAncillaries = pdfType === 'full';
  const showCancellation = pdfType !== 'flight_only';

  const pdfTypeLabel = pdfType === 'hotel_only' ? 'Hotel Only Quote'
    : pdfType === 'flight_only' ? 'Flight Only Quote' : '';

  const versionLabel   = `V${proposal.version || 1}`;
  const footerContact  = [orgName, orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');
  const coverBgStyle   = coverImageDataUri
    ? `background: url('${coverImageDataUri}') center/cover no-repeat;`
    : 'background: linear-gradient(135deg, #1e3a5f, #2d5f8a);';

  // ── FIX 4: Pricing — Grand Total only ────────────────────────────────────
  const pricingRows = (() => {
    const totalPax     = (proposal.pax_adults as number || 0) + (proposal.pax_children as number || 0);
    const totalGroupSP = Number(proposal.total_sp) || 0;
    const discount     = Number(proposal.discount_amount) || 0;
    const landSP       = Number(proposal.land_sp) || 0;
    const gstAmount    = proposal.gst_enabled ? landSP * (Number(proposal.gst_rate) || 5) / 100 : 0;
    const afterDiscount = totalGroupSP - discount;
    const tcsAmount    = proposal.tcs_enabled ? (afterDiscount + gstAmount) * (Number(proposal.tcs_rate) || 5) / 100 : 0;
    const grandTotal   = afterDiscount + gstAmount + tcsAmount;

    let rows = '';
    if (totalGroupSP > 0)
      rows += `<tr><td>Total Package Price (${totalPax} pax)</td><td style="text-align:right;">${cur}${totalGroupSP.toLocaleString('en-IN')}</td></tr>`;
    if (discount > 0)
      rows += `<tr><td>Discount${proposal.discount_note ? ` (${cleanText(proposal.discount_note as string)})` : ''}</td><td style="text-align:right;color:#dc2626;">-${cur}${discount.toLocaleString('en-IN')}</td></tr>`;
    if (proposal.gst_enabled)
      rows += `<tr><td>GST (${proposal.gst_rate}%)</td><td style="text-align:right;">${cur}${Math.round(gstAmount).toLocaleString('en-IN')}</td></tr>`;
    if (proposal.tcs_enabled)
      rows += `<tr><td>TCS (${proposal.tcs_rate || 5}%)</td><td style="text-align:right;">${cur}${Math.round(tcsAmount).toLocaleString('en-IN')}</td></tr>`;
    rows += `<tr class="grand-total-row"><td><strong>Grand Total</strong></td><td style="text-align:right;"><strong>${cur}${Math.round(grandTotal).toLocaleString('en-IN')}</strong></td></tr>`;
    return rows;
  })();

  // ── FIX 2: Flights — redesigned layout ───────────────────────────────────
  // FIX 1: IATA codes UPPERCASE, airline name Title Case, flight number UPPERCASE
  const flightsHtml = showFlights && (flights || []).length > 0 ? `
<div class="section">
  <h2>Flights</h2>
  ${(flights || []).map((f: Record<string, unknown>) => {
    const fLayovers = (f.layovers as Array<{ city: string; airport_code: string; duration_hours: number; duration_minutes: number }>) || [];

    // Duration: stored minutes → "Xh Ym". Fallback: calculate from dep/arr timestamps.
    const storedMinutes = Number(f.duration_minutes) || 0;
    let durationText = '';
    if (storedMinutes > 0) {
      durationText = `${Math.floor(storedMinutes / 60)}h ${storedMinutes % 60}m`;
    } else if (f.departure_at && f.arrival_at) {
      const diffMs = new Date(f.arrival_at as string).getTime() - new Date(f.departure_at as string).getTime();
      if (diffMs > 0) {
        const diffMin = Math.round(diffMs / 60000);
        durationText = `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
      }
    }
    if (!durationText && f.duration) durationText = String(f.duration);

    // FIX 1: airline Title Case, flight number UPPERCASE, IATA codes UPPERCASE
    const airlineName  = f.airline ? toTitleCase(String(f.airline)) : '';
    const flightNum    = f.flight_number ? String(f.flight_number).toUpperCase() : '';
    const cabinClass   = f.cabin_class ? toTitleCase(String(f.cabin_class)) : '';
    const originCity   = toTitleCase(String(f.origin_city || ''));
    const originIata   = f.origin_iata ? String(f.origin_iata).toUpperCase() : '';
    const destCity     = toTitleCase(String(f.destination_city || ''));
    const destIata     = f.destination_iata ? String(f.destination_iata).toUpperCase() : '';

    return `
    <div class="card" style="margin-bottom:16px;">
      <!-- Header: Airline | Flight Number | Cabin -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e5e5e5;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${airlineName ? `<strong style="font-size:1.05rem;color:#1e3a5f;">${airlineName}</strong>` : ''}
          ${flightNum ? `<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-size:0.85rem;font-weight:600;">${flightNum}</span>` : ''}
        </div>
        ${cabinClass ? `<span style="background:#e0e7ff;color:#3730a3;padding:2px 10px;border-radius:4px;font-size:0.8rem;font-weight:600;">${cabinClass}</span>` : ''}
      </div>
      <!-- Route table -->
      <table style="margin:0;">
        <thead>
          <tr>
            <th style="width:35%;">From</th>
            <th style="width:35%;">To</th>
            <th style="width:15%;">Duration</th>
            ${f.baggage_allowance ? '<th style="width:15%;">Baggage</th>' : ''}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${originCity}${originIata ? ` (${originIata})` : ''}</strong><br/>
              <span style="font-size:0.82rem;color:#666;">${fmtDate(f.departure_at as string)}</span><br/>
              <span style="font-size:0.9rem;font-weight:600;">${fmtTime(f.departure_at as string)}</span>
            </td>
            <td>
              <strong>${destCity}${destIata ? ` (${destIata})` : ''}</strong><br/>
              <span style="font-size:0.82rem;color:#666;">${fmtDate(f.arrival_at as string)}</span><br/>
              <span style="font-size:0.9rem;font-weight:600;">${fmtTime(f.arrival_at as string)}</span>
            </td>
            <td style="vertical-align:middle;">${durationText || '—'}</td>
            ${f.baggage_allowance ? `<td style="vertical-align:middle;">${cleanText(String(f.baggage_allowance))}</td>` : ''}
          </tr>
        </tbody>
      </table>
      ${fLayovers.length > 0 ? `
      <div style="margin-top:10px;">
        ${fLayovers.map((l) => `
          <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#f8f9fa;border-left:3px solid #94a3b8;margin:4px 0;font-size:0.83rem;">
            <span style="color:#64748b;">&#x23F1;</span>
            <strong>Layover:</strong>&nbsp;${toTitleCase(l.city)}${l.airport_code ? ` (${l.airport_code.toUpperCase()})` : ''} &#8212; ${l.duration_hours}h${l.duration_minutes > 0 ? ` ${l.duration_minutes}m` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>`;
  }).join('')}
</div>
` : '';

  // ── Hotels ────────────────────────────────────────────────────────────────
  const hotelsHtml = showHotels && (hotels || []).length > 0 ? `
<div class="section">
  <h2>Hotels</h2>
  <table>
    <thead>
      <tr>
        <th>Hotel</th>
        <th>Room Type</th>
        <th>Meal Plan</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th style="text-align:center;">Nights</th>
      </tr>
    </thead>
    <tbody>
    ${(hotels || []).map((h: Record<string, unknown>) => `
      <tr>
        <td>
          <strong>${toTitleCase(String(h.name || ''))}</strong><br/>
          <span style="font-size:0.8rem;color:#555;">${toTitleCase(String(h.city || ''))}${Number(h.star_rating) > 0 ? ` &middot; ${'&#9733;'.repeat(Number(h.star_rating))}` : ''}</span><br/>
          <span class="badge ${h.is_non_refundable ? 'badge-nr' : 'badge-r'}" style="margin-top:3px;">${h.is_non_refundable ? 'Non-Refundable' : 'Refundable'}</span>
        </td>
        <td>${toTitleCase(String(h.room_type || 'N/A'))}</td>
        <td>${toTitleCase(String(h.meal_plan || 'N/A'))}</td>
        <td>${h.check_in ? fmtDate(String(h.check_in)) : 'N/A'}</td>
        <td>${h.check_out ? fmtDate(String(h.check_out)) : 'N/A'}</td>
        <td style="text-align:center;font-weight:600;">${h.nights ?? '&#8212;'}</td>
      </tr>
      ${h.description ? `<tr><td colspan="6" style="padding:4px 12px 12px;color:#555;font-size:0.84rem;">${cleanText(h.description as string)}</td></tr>` : ''}
    `).join('')}
    </tbody>
  </table>
</div>
` : '';

  // ── HTML document ─────────────────────────────────────────────────────────
  // FIX 4: NO footer div in body — Puppeteer footerTemplate is the only footer
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.6; background: #fff; }

  @page { size: A4; margin: 0 0 44px 0; }

  .cover {
    position: relative; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    text-align: center; color: white; page-break-after: always;
  }
  .cover-bg      { position: absolute; inset: 0; ${coverBgStyle} }
  .cover-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }
  .cover-content { position: relative; z-index: 1; padding: 0 40px; max-width: 700px; }
  .cover h1      { font-size: 2.6rem; margin-bottom: 0.5rem; font-weight: 700; }
  .cover h2      { font-size: 1.4rem; font-weight: 300; margin-bottom: 1rem; opacity: 0.9; }
  .cover p       { font-size: 1rem; opacity: 0.85; }
  .cover .agent-info  { margin-top: 2rem; font-size: 0.85rem; opacity: 0.75; }
  .cover .type-label  { display:inline-block; margin-top:1rem; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); padding:4px 16px; border-radius:20px; font-size:0.9rem; font-weight:600; letter-spacing:0.05em; }

  .section       { padding: 32px 48px; page-break-inside: avoid; }
  .section h2    { font-size: 1.4rem; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 6px; margin-bottom: 16px; }
  .section h3    { font-size: 1rem; color: #2d5f8a; margin: 14px 0 6px; }

  table          { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td         { padding: 9px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 0.88rem; }
  th             { background: #f5f7fa; color: #1e3a5f; font-weight: 600; }

  .card          { border: 1px solid #e5e5e5; border-radius: 8px; padding: 18px; margin-bottom: 14px; }
  .day-card      { margin-bottom: 22px; }
  .day-number    { display: inline-flex; align-items: center; justify-content: center; background: #1e3a5f; color: white; border-radius: 50%; width: 30px; height: 30px; font-weight: bold; margin-right: 8px; font-size: 0.85rem; }
  .grand-total-row td { font-size: 1.1rem; background: #f5f7fa; border-top: 2px solid #1e3a5f; }
  .addons        { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 18px; margin-top: 16px; }
  .badge         { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
  .badge-nr      { background: #fee2e2; color: #991b1b; }
  .badge-r       { background: #dcfce7; color: #166534; }
  ul             { padding-left: 18px; }
  li             { margin-bottom: 3px; font-size: 0.88rem; }
</style>
</head><body>

<!-- Cover Page — FIX 6: Title Case on all cover text -->
<div class="cover">
  <div class="cover-bg"></div>
  <div class="cover-overlay"></div>
  <div class="cover-content">
    ${orgLogoDataUri ? `<img src="${orgLogoDataUri}" style="height:56px;margin-bottom:18px;object-fit:contain;" />` : ''}
    ${orgName ? `<p style="font-size:1.1rem;margin-bottom:10px;">${orgName}</p>` : ''}
    <h1>${toTitleCase(String(proposal.title || 'Travel Proposal'))}</h1>
    <h2>${toTitleCase(String(proposal.destination || ''))}</h2>
    <p>Prepared for ${toTitleCase(String((client as Record<string, unknown>)?.full_name || 'Valued Client'))}</p>
    <div class="agent-info">
      <p>Prepared by: ${toTitleCase(agentName)}${agentEmail ? ` | ${agentEmail}` : ''}</p>
    </div>
    ${pdfTypeLabel ? `<div class="type-label">${pdfTypeLabel}</div>` : ''}
  </div>
</div>

<!-- Trip Summary -->
<div class="section">
  <h2>Trip Summary</h2>
  <table>
    <tr><td><strong>Destination</strong></td><td>${toTitleCase(String(proposal.destination || 'N/A'))}</td></tr>
    <tr><td><strong>Travel Dates</strong></td><td>${proposal.travel_start ? fmtDate(String(proposal.travel_start)) : 'N/A'} to ${proposal.travel_end ? fmtDate(String(proposal.travel_end)) : 'N/A'}</td></tr>
    <tr><td><strong>Travellers</strong></td><td>${proposal.pax_adults} Adults${(proposal.pax_children as number) > 0 ? `, ${proposal.pax_children} Children` : ''}</td></tr>
    ${proposal.special_notes ? `<tr><td><strong>Special Occasions</strong></td><td>${cleanText(String(proposal.special_notes))}</td></tr>` : ''}
    ${proposal.dietary_notes ? `<tr><td><strong>Dietary Notes</strong></td><td>${cleanText(String(proposal.dietary_notes))}</td></tr>` : ''}
  </table>
</div>

${hotelsHtml}

${flightsHtml}

${showItinerary ? `
<!-- Itinerary -->
<div class="section">
  <h2>Day-Wise Itinerary</h2>
  ${(itineraryDays || []).map((day: Record<string, unknown>) => {
    const dayActs = (activities || []).filter((a: Record<string, unknown>) => a.itinerary_day_id === day.id && !a.is_optional);
    const heading = day.heading ? toTitleCase(cleanText(day.heading as string)) : `Day ${day.day_number}`;
    const desc    = cleanText(day.description as string) || 'Itinerary to be updated.';
    return `
      <div class="day-card">
        <h3><span class="day-number">${day.day_number}</span>${heading}${day.city ? ` &#8212; ${toTitleCase(String(day.city))}` : ''}</h3>
        <p style="margin:6px 0 8px;color:#555;font-size:0.88rem;">${desc}</p>
        ${dayActs.length > 0 ? `<ul>${dayActs.map((a: Record<string, unknown>) => `<li>${toTitleCase(cleanText(a.type as string))}: ${cleanText((a.details as Record<string, unknown>)?.title as string || (a.details as Record<string, unknown>)?.from_location as string || a.location as string || '')}</li>`).join('')}</ul>` : ''}
      </div>
    `;
  }).join('')}
</div>
` : ''}

${showInclExcl ? `
<!-- Inclusions & Exclusions -->
<div class="section">
  <h2>Inclusions &amp; Exclusions</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
    <div>
      <h3 style="color:#166534;">Included</h3>
      ${inclusions.length > 0 ? `<ul>${inclusions.map((li: Record<string, unknown>) => `<li>${cleanText(li.description as string)}</li>`).join('')}</ul>` : '<p style="color:#888;font-size:0.85rem;">No inclusions specified</p>'}
    </div>
    <div>
      <h3 style="color:#991b1b;">Excluded</h3>
      ${exclusions.length > 0 ? `<ul>${exclusions.map((li: Record<string, unknown>) => `<li>${cleanText(li.description as string)}</li>`).join('')}</ul>` : '<p style="color:#888;font-size:0.85rem;">No exclusions specified</p>'}
    </div>
  </div>
</div>
` : ''}

<!-- Pricing Summary -->
<div class="section">
  <h2>Pricing Summary</h2>
  <table>${pricingRows}</table>
</div>

${showCancellation ? `
<!-- Cancellation Policy -->
<div class="section">
  <h2>Cancellation Policy</h2>
  ${showFlights && (flights || []).length > 0 ? `
  <h3>Flights</h3>
  <table>
    <thead><tr><th>Flight</th><th>Baggage</th><th>Status</th><th>Policy</th></tr></thead>
    <tbody>
    ${(flights || []).map((f: Record<string, unknown>) => `
      <tr>
        <td>${String(f.flight_number || '').toUpperCase()}${f.airline ? ` (${toTitleCase(String(f.airline))})` : ''}</td>
        <td>${f.baggage_allowance ? cleanText(String(f.baggage_allowance)) : 'N/A'}</td>
        <td>${f.is_non_refundable ? 'Non-Refundable' : (f.refundable_status === 'partially_refundable' ? 'Partially Refundable' : 'Refundable')}</td>
        <td>${f.cancellation_policy_text ? cleanText(String(f.cancellation_policy_text)) : (f.is_non_refundable ? 'Non-refundable from date of ticketing' : 'Standard airline policy applies')}</td>
      </tr>
    `).join('')}
    </tbody>
  </table>
  ` : ''}
  ${showHotels && (hotels || []).length > 0 ? `
  <h3>Hotels</h3>
  <table>
    <thead><tr><th>Hotel</th><th>Status</th><th>Cancellation Slabs</th></tr></thead>
    <tbody>
    ${(hotels || []).map((h: Record<string, unknown>) => {
      const slabs = (h.hotel_cancellation_slabs as Array<{ days_before: number; charge_pct: number }>) || [];
      return `
      <tr>
        <td>${toTitleCase(String(h.name || ''))}</td>
        <td>${h.is_non_refundable ? 'Non-Refundable' : 'Refundable'}</td>
        <td>${h.is_non_refundable ? '100% from booking' : (slabs.length ? slabs.map((s) => `${s.days_before}+ days: ${s.charge_pct}%`).join(' | ') : 'Policy not specified')}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
  ` : ''}
  ${(() => {
    const draftData  = (proposal.draft_data || {}) as Record<string, unknown>;
    const landSlabs  = (draftData.land_cancellation_slabs as Array<{ days_before: number; charge_pct: number; notes?: string }>) || [];
    if (landSlabs.length === 0) return '';
    return `
    <h3>Land / DMC Cancellation</h3>
    <table>
      <thead><tr><th>Days Before Departure</th><th>Cancellation Charge</th><th>Notes</th></tr></thead>
      <tbody>
      ${landSlabs.map((s) => `<tr><td>${s.days_before}+ days</td><td>${s.charge_pct}%</td><td>${s.notes ? cleanText(s.notes) : ''}</td></tr>`).join('')}
      </tbody>
    </table>`;
  })()}
</div>
` : ''}

<!-- Payment Terms -->
<div class="section">
  <h2>Payment Terms</h2>
  <p>${(proposal.payment_terms as Record<string, unknown>)?.deposit_pct || 25}% deposit upon booking confirmation</p>
  <p>Balance due ${(proposal.payment_terms as Record<string, unknown>)?.balance_days_before || 30} days before departure</p>
  ${(proposal.payment_terms as Record<string, unknown>)?.notes ? `<p style="margin-top:6px;">${cleanText(String((proposal.payment_terms as Record<string, unknown>).notes))}</p>` : ''}
</div>

${showAncillaries && optionalAddons.length > 0 ? `
<!-- Optional Add-ons -->
<div class="section">
  <div class="addons">
    <h2 style="color:#166534;border-color:#166534;">Enhance Your Trip</h2>
    <table>
      <thead><tr><th>Activity</th><th style="text-align:right;">Price</th></tr></thead>
      <tbody>
      ${optionalAddons.map((a: Record<string, unknown>) => `
        <tr>
          <td>${toTitleCase(cleanText(a.type as string))}: ${cleanText(String((a.details as Record<string, unknown>)?.title || a.location || ''))}</td>
          <td style="text-align:right;">${cur}${Number(a.pvt_sp || a.sic_sp || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
      </tbody>
    </table>
  </div>
</div>
` : ''}

</body></html>`;

  // ── Puppeteer ─────────────────────────────────────────────────────────────
  let browser;
  try {
    if (process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = (await import('puppeteer-core')).default;
      chromium.setGraphicsMode = false;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // FIX 4: Single footer — Puppeteer footerTemplate only (no footer div in body HTML)
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '44px', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 40px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#666;border-top:1px solid #ddd;height:36px;box-sizing:border-box;font-family:sans-serif;">
        <span>${footerContact}</span>
        <span>${versionLabel} | Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    });
    await browser.close();

    const typeSuffix = pdfType !== 'full' ? `-${pdfType}` : '';
    const filename = `proposal-${String(proposal.title || id).replace(/[^a-z0-9]/gi, '-').toLowerCase()}${typeSuffix}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', err);
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  }
}
