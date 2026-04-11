import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { cleanText } from '@/lib/utils/text-sanitise';
import { getCurrencySymbol } from '@/lib/utils/pricing';

export const runtime = 'nodejs';
export const maxDuration = 10; // seconds — Vercel Hobby plan

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  // Currency symbol — mapped from proposal currency code
  const currencySymbol = getCurrencySymbol(proposal.currency as string);

  // Fetch org details via user.org_id
  const agentUser = user as Record<string, unknown> | null;
  let org: Record<string, unknown> | null = null;
  if (agentUser?.org_id) {
    const { data: orgData } = await supabase
      .from('organisations')
      .select('*')
      .eq('id', agentUser.org_id as string)
      .single();
    org = orgData;
  }

  const orgName = (org?.name || agentUser?.agency_name || '') as string;
  const orgLogo = (org?.logo_url || agentUser?.logo_url || '') as string;
  const orgPhone = (org?.phone || '') as string;
  const orgEmail = (org?.email || agentUser?.email || '') as string;
  const orgWebsite = (org?.website || '') as string;
  const agentName = (agentUser?.full_name || '') as string;
  const agentEmail = (agentUser?.email || '') as string;

  // Calculate totals — CP NEVER appears in PDF
  // Pricing is computed inline in the PDF pricing section from proposal fields

  function toTitleCase(str: string): string {
    const minor = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','up','via','with']);
    return str.replace(/\S+/g, (word, offset) => {
      const clean = word.replace(/[^a-zA-Z]/g, '');
      if (offset > 0 && minor.has(clean.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }

  const optionalAddons = (activities || []).filter((a: Record<string, unknown>) => a.is_optional);

  const inclusions = (lineItems || []).filter((li: Record<string, unknown>) => li.is_included && li.description);
  const exclusions = (lineItems || []).filter((li: Record<string, unknown>) => !li.is_included && li.description);

  const headerHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 60px;border-bottom:1px solid #e5e5e5;font-size:0.75rem;color:#666;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${orgLogo ? `<img src="${orgLogo}" style="height:24px;object-fit:contain;" />` : ''}
        <span>${orgName}</span>
      </div>
    </div>`;

  const footerHtml = `
    <div style="text-align:center;padding:8px 60px;border-top:1px solid #e5e5e5;font-size:0.7rem;color:#888;">
      ${[orgName, orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ')}
    </div>`;

  // Build HTML
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.6; }
  .cover { position: relative; height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; color: white; page-break-after: always; }
  .cover-bg { position: absolute; inset: 0; background: ${proposal.cover_image_url ? `url('${proposal.cover_image_url}') center/cover` : 'linear-gradient(135deg, #1e3a5f, #2d5f8a)'}; }
  .cover-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
  .cover-content { position: relative; z-index: 1; }
  .cover h1 { font-size: 3rem; margin-bottom: 0.5rem; }
  .cover h2 { font-size: 1.5rem; font-weight: 300; margin-bottom: 1rem; }
  .cover p { font-size: 1.1rem; opacity: 0.9; }
  .cover .agent-info { margin-top: 2rem; font-size: 0.9rem; opacity: 0.8; }
  .page-header { display:flex;align-items:center;justify-content:space-between;padding:8px 60px;border-bottom:1px solid #e5e5e5;font-size:0.75rem;color:#666; }
  .page-footer { text-align:center;padding:8px 60px;border-top:1px solid #e5e5e5;font-size:0.7rem;color:#888; }
  .section { padding: 40px 60px; page-break-inside: avoid; }
  .section h2 { font-size: 1.5rem; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 20px; }
  .section h3 { font-size: 1.1rem; color: #2d5f8a; margin: 16px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 0.9rem; }
  th { background: #f5f7fa; color: #1e3a5f; font-weight: 600; }
  .hotel-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
  .hotel-card h3 { margin-top: 0; }
  .day-card { margin-bottom: 24px; }
  .day-number { display: inline-block; background: #1e3a5f; color: white; border-radius: 50%; width: 32px; height: 32px; text-align: center; line-height: 32px; font-weight: bold; margin-right: 8px; }
  .total-row { font-size: 1.2rem; font-weight: bold; background: #f5f7fa; }
  .grand-total { font-size: 1.4rem; font-weight: bold; color: #1e3a5f; }
  .addons { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-top: 20px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
  .badge-nr { background: #fee2e2; color: #991b1b; }
  .badge-r { background: #dcfce7; color: #166534; }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
</style>
</head><body>

<!-- Cover Page -->
<div class="cover">
  <div class="cover-bg"></div>
  <div class="cover-overlay"></div>
  <div class="cover-content">
    ${orgLogo ? `<img src="${orgLogo}" style="height:60px;margin-bottom:20px;" />` : ''}
    ${orgName ? `<p style="font-size:1.2rem;margin-bottom:12px;">${orgName}</p>` : ''}
    <h1>${proposal.title || 'Travel Proposal'}</h1>
    <h2>${proposal.destination || ''}</h2>
    <p>Prepared for ${(client as Record<string, unknown>)?.full_name || 'Valued Client'}</p>
    <div class="agent-info">
      <p>Prepared by: ${agentName}${agentEmail ? ` | ${agentEmail}` : ''}</p>
    </div>
  </div>
</div>

<!-- Page Header -->
${headerHtml}

<!-- Trip Summary -->
<div class="section">
  <h2>Trip Summary</h2>
  <table>
    <tr><td><strong>Destination</strong></td><td>${proposal.destination || 'N/A'}</td></tr>
    <tr><td><strong>Travel Dates</strong></td><td>${proposal.travel_start || 'N/A'} to ${proposal.travel_end || 'N/A'}</td></tr>
    <tr><td><strong>Travellers</strong></td><td>${proposal.pax_adults} Adults${proposal.pax_children > 0 ? `, ${proposal.pax_children} Children` : ''}</td></tr>
    ${proposal.special_notes ? `<tr><td><strong>Special Occasions</strong></td><td>${proposal.special_notes}</td></tr>` : ''}
    ${proposal.dietary_notes ? `<tr><td><strong>Dietary Notes</strong></td><td>${proposal.dietary_notes}</td></tr>` : ''}
  </table>
</div>

<!-- Hotels -->
<div class="section">
  <h2>Hotels</h2>
  ${(hotels || []).map((h: Record<string, unknown>) => `
    <div class="hotel-card">
      <h3>${'★'.repeat(Number(h.star_rating) || 0)} ${h.name} — ${h.city}</h3>
      <table>
        <tr><td>Check-in</td><td>${h.check_in}</td><td>Check-out</td><td>${h.check_out}</td><td>Nights</td><td>${h.nights}</td></tr>
        <tr><td>Room Type</td><td>${h.room_type || 'N/A'}</td><td>Meal Plan</td><td>${h.meal_plan || 'N/A'}</td><td></td><td></td></tr>
      </table>
      ${h.description ? `<p style="margin-top:8px;color:#555;">${cleanText(h.description as string)}</p>` : ''}
      <p><span class="badge ${h.is_non_refundable ? 'badge-nr' : 'badge-r'}">${h.is_non_refundable ? 'Non-Refundable' : 'Refundable'}</span></p>
    </div>
  `).join('')}
</div>

<!-- Flights -->
${(flights || []).length > 0 ? `
<div class="section">
  <h2>Flights</h2>
  ${(flights || []).map((f: Record<string, unknown>) => {
    const fLayovers = (f.layovers as Array<{ city: string; airport_code: string; duration_hours: number; duration_minutes: number }>) || [];
    const baggageText = f.baggage_allowance ? String(f.baggage_allowance) : '';
    const cabinText = f.cabin_class ? String(f.cabin_class) : '';
    return `
    <div class="hotel-card" style="margin-bottom:16px;">
      <h3 style="margin-top:0;">${f.flight_number}${f.airline ? ` — ${f.airline}` : ''}</h3>
      <table>
        <tr>
          <td><strong>Route</strong></td>
          <td>${f.origin_city || ''}${f.origin_iata ? ` (${f.origin_iata})` : ''} → ${f.destination_city || ''}${f.destination_iata ? ` (${f.destination_iata})` : ''}</td>
          <td><strong>Departure</strong></td>
          <td>${f.departure_at ? new Date(f.departure_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Arrival</strong></td>
          <td>${f.arrival_at ? new Date(f.arrival_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</td>
          ${cabinText ? `<td><strong>Cabin</strong></td><td>${cabinText}</td>` : '<td></td><td></td>'}
        </tr>
        ${baggageText ? `<tr><td><strong>Baggage</strong></td><td colspan="3">${baggageText}</td></tr>` : ''}
        ${f.sp_total ? `<tr><td><strong>Amount</strong></td><td colspan="3">${currencySymbol}${Number(f.sp_total).toLocaleString('en-IN')}</td></tr>` : ''}
      </table>
      ${fLayovers.length > 0 ? `
      <div style="margin-top:8px;">
        ${fLayovers.map(l => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:#f8f9fa;border-radius:4px;margin:4px 0;font-size:0.85rem;">
            <span style="color:#666;">⏱</span>
            <strong>Layover:</strong> ${l.city}${l.airport_code ? ` (${l.airport_code})` : ''} — ${l.duration_hours}h${l.duration_minutes > 0 ? ` ${l.duration_minutes}m` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>`;
  }).join('')}
</div>
` : ''}

<!-- Itinerary -->
<div class="section">
  <h2>Day-wise Itinerary</h2>
  ${(itineraryDays || []).map((day: Record<string, unknown>) => {
    const dayActs = (activities || []).filter((a: Record<string, unknown>) => a.itinerary_day_id === day.id && !a.is_optional);
    const heading = (day.heading ? toTitleCase(cleanText(day.heading as string)) : null) || `Day ${day.day_number}`;
    const desc = cleanText(day.description as string) || 'Itinerary to be updated.';
    return `
      <div class="day-card">
        <h3><span class="day-number">${day.day_number}</span> ${heading} ${day.city ? `— ${day.city}` : ''}</h3>
        <p style="margin:8px 0;color:#555;">${desc}</p>
        ${dayActs.length > 0 ? `<ul>${dayActs.map((a: Record<string, unknown>) => `<li>${cleanText(a.type as string)}: ${cleanText((a.details as Record<string, unknown>)?.title as string || (a.details as Record<string, unknown>)?.from_location as string || a.location as string || '')}</li>`).join('')}</ul>` : ''}
      </div>
    `;
  }).join('')}
</div>

<!-- Inclusions & Exclusions -->
<div class="section">
  <h2>Inclusions & Exclusions</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
    <div>
      <h3 style="color:green;">Included</h3>
      ${inclusions.length > 0 ? `<ul>${inclusions.map((li: Record<string, unknown>) => `<li>${cleanText(li.description as string)}</li>`).join('')}</ul>` : '<p style="color:#888;">No inclusions specified</p>'}
    </div>
    <div>
      <h3 style="color:red;">Excluded</h3>
      ${exclusions.length > 0 ? `<ul>${exclusions.map((li: Record<string, unknown>) => `<li>${cleanText(li.description as string)}</li>`).join('')}</ul>` : '<p style="color:#888;">No exclusions specified</p>'}
    </div>
  </div>
</div>

<!-- Pricing Summary (client-facing only) -->
<div class="section">
  <h2>Pricing Summary</h2>
  <table>
    ${(() => {
      const displayMode = (proposal.pricing_display_mode as string) || 'per_person';
      const adultSP = Number(proposal.package_sp_per_person) || 0;
      const cwbSP = Number(proposal.package_cwb_sp) || 0;
      const cnbSP = Number(proposal.package_cnb_sp) || 0;
      const totalGroupSP = Number(proposal.total_sp) || 0;
      const discount = Number(proposal.discount_amount) || 0;
      const landSP = Number(proposal.land_sp) || 0;
      const gstAmount = proposal.gst_enabled ? landSP * (Number(proposal.gst_rate) || 5) / 100 : 0;

      let rows = '';
      if (displayMode === 'per_person' || displayMode === 'both') {
        if (adultSP > 0) rows += `<tr><td>Per Adult</td><td style="text-align:right;">${currencySymbol}${adultSP.toLocaleString('en-IN')}</td></tr>`;
        if (proposal.pax_children > 0 && cwbSP > 0) rows += `<tr><td>Per Child (CWB)</td><td style="text-align:right;">${currencySymbol}${cwbSP.toLocaleString('en-IN')}</td></tr>`;
        if (proposal.pax_children > 0 && cnbSP > 0) rows += `<tr><td>Per Child (CNB)</td><td style="text-align:right;">${currencySymbol}${cnbSP.toLocaleString('en-IN')}</td></tr>`;
      }
      if (displayMode === 'total' || displayMode === 'both') {
        const totalPax = proposal.pax_adults + (proposal.pax_children || 0);
        if (totalGroupSP > 0) rows += `<tr><td>Total Package Price (${totalPax} pax)</td><td style="text-align:right;">${currencySymbol}${totalGroupSP.toLocaleString('en-IN')}</td></tr>`;
      }

      // Determine base for grand total
      const baseSP = displayMode === 'total' ? totalGroupSP
        : (proposal.pax_adults * adultSP) + (proposal.pax_children * cwbSP);
      const afterDiscount = baseSP - discount;
      const tcsAmount = proposal.tcs_enabled ? (afterDiscount + gstAmount) * (Number(proposal.tcs_rate) || 5) / 100 : 0;
      const grandTotal = afterDiscount + gstAmount + tcsAmount;

      if (discount > 0) rows += `<tr><td>Discount${proposal.discount_note ? ` (${cleanText(proposal.discount_note as string)})` : ''}</td><td style="text-align:right;color:red;">-${currencySymbol}${discount.toLocaleString('en-IN')}</td></tr>`;
      if (proposal.gst_enabled) rows += `<tr><td>GST (${proposal.gst_rate}%)</td><td style="text-align:right;">${currencySymbol}${Math.round(gstAmount).toLocaleString('en-IN')}</td></tr>`;
      if (proposal.tcs_enabled) rows += `<tr><td>TCS (${proposal.tcs_rate || 5}%)</td><td style="text-align:right;">${currencySymbol}${Math.round(tcsAmount).toLocaleString('en-IN')}</td></tr>`;
      rows += `<tr class="total-row"><td class="grand-total">Grand Total</td><td style="text-align:right;" class="grand-total">${currencySymbol}${Math.round(grandTotal).toLocaleString('en-IN')}</td></tr>`;
      return rows;
    })()}
  </table>
</div>

<!-- Cancellation Policy -->
<div class="section">
  <h2>Cancellation Policy</h2>
  ${(flights || []).length > 0 ? `
  <h3>Flights</h3>
  <table>
    <thead><tr><th>Flight</th><th>Baggage</th><th>Status</th><th>Policy</th></tr></thead>
    <tbody>
    ${(flights || []).map((f: Record<string, unknown>) => `
      <tr>
        <td>${f.flight_number} ${f.airline ? `(${f.airline})` : ''}</td>
        <td>${f.baggage_allowance ? cleanText(f.baggage_allowance as string) : 'N/A'}</td>
        <td>${f.is_non_refundable ? 'Non-refundable' : (f.refundable_status === 'partially_refundable' ? 'Partially Refundable' : 'Refundable')}</td>
        <td>${f.cancellation_policy_text ? cleanText(f.cancellation_policy_text as string) : (f.is_non_refundable ? 'Non-refundable from date of ticketing' : 'Standard airline policy applies')}</td>
      </tr>
    `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${(hotels || []).length > 0 ? `
  <h3>Hotels</h3>
  <table>
    <thead><tr><th>Hotel</th><th>Status</th><th>Cancellation Slabs</th></tr></thead>
    <tbody>
    ${(hotels || []).map((h: Record<string, unknown>) => {
      const slabs = (h.hotel_cancellation_slabs as Array<{ days_before: number; charge_pct: number }>) || [];
      return `
      <tr>
        <td>${h.name}</td>
        <td>${h.is_non_refundable ? 'Non-refundable' : 'Refundable'}</td>
        <td>${h.is_non_refundable ? '100% from booking' : (slabs.length ? slabs.map(s => `${s.days_before}+ days: ${s.charge_pct}%`).join(' | ') : 'Policy not specified')}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
  ` : ''}

  ${(() => {
    const draftData = (proposal.draft_data || {}) as Record<string, unknown>;
    const landSlabs = (draftData.land_cancellation_slabs as Array<{ days_before: number; charge_pct: number; notes?: string }>) || [];
    if (landSlabs.length === 0) return '';
    return `
    <h3>Land / DMC Cancellation</h3>
    <table>
      <thead><tr><th>Days Before Departure</th><th>Cancellation Charge</th><th>Notes</th></tr></thead>
      <tbody>
      ${landSlabs.map(s => `<tr><td>${s.days_before}+ days</td><td>${s.charge_pct}%</td><td>${s.notes ? cleanText(s.notes) : ''}</td></tr>`).join('')}
      </tbody>
    </table>`;
  })()}
</div>

<!-- Payment Terms -->
<div class="section">
  <h2>Payment Terms</h2>
  <p>${(proposal.payment_terms as Record<string, unknown>)?.deposit_pct || 25}% deposit upon booking confirmation</p>
  <p>Balance due ${(proposal.payment_terms as Record<string, unknown>)?.balance_days_before || 30} days before departure</p>
  ${(proposal.payment_terms as Record<string, unknown>)?.notes ? `<p>${cleanText((proposal.payment_terms as Record<string, unknown>).notes as string)}</p>` : ''}
</div>

<!-- Optional Add-ons -->
${optionalAddons.length > 0 ? `
<div class="section">
  <div class="addons">
    <h2 style="color:#166534;border-color:#166534;">Enhance Your Trip</h2>
    <table>
      <thead><tr><th>Activity</th><th>Price</th></tr></thead>
      <tbody>
      ${optionalAddons.map((a: Record<string, unknown>) => `
        <tr><td>${a.type}: ${(a.details as Record<string, unknown>)?.title || a.location || ''}</td><td>${currencySymbol}${Number(a.pvt_sp || a.sic_sp || 0).toLocaleString('en-IN')}</td></tr>
      `).join('')}
      </tbody>
    </table>
  </div>
</div>
` : ''}

<!-- Page Footer -->
${footerHtml}

</body></html>`;

  // Launch browser — @sparticuz/chromium on Vercel, full puppeteer locally
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
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    await browser.close();

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="proposal-${proposal.title || id}.pdf"`,
      },
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', err);
    // Fallback: return HTML so the user gets something
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
