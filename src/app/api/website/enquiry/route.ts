import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateTripIdFromDb, requirementToServiceType, type TripIdConfig, DEFAULT_TRIP_ID_CONFIG } from '@/lib/utils/generateId';
import nodemailer from 'nodemailer';

// Simple in-memory rate limiter: max 5 submissions per IP per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const ALLOWED_ORIGINS = [
  'https://eztrips.in',
  'https://www.eztrips.in',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return origin;
  return null;
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = getAllowedOrigin(request);
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = getAllowedOrigin(request);
  const headers = corsHeaders(origin);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers }
    );
  }

  try {
    const body = await request.json();
    // Accept both camelCase (from website form) and snake_case
    const name = body.name;
    const email = body.email;
    const phone = body.phone;
    const destination = body.destination;
    const travel_date = body.travel_date || body.travelDate || null;
    const date_flexible = body.date_flexible ?? body.dateFlexible ?? false;
    const flexibility_days = body.flexibility_days || body.flexibilityDays || null;
    const adults = body.adults;
    const children = body.children ?? 0;
    const children_ages = body.children_ages || body.childrenAges || null;
    const budget_range = body.budget_range || body.budgetRange || null;
    const budget_type = body.budget_type || body.budgetType || null;
    const special_requirements = body.special_requirements || body.specialRequirements || null;
    const whatsapp_opted = body.whatsapp_opted ?? body.whatsappOptin ?? false;
    const source = body.source || null;
    const number_of_nights = body.number_of_nights || body.numberOfNights || null;
    const hotel_category = body.hotel_category || body.hotelCategory || null;
    const requirement_type = body.requirement_type || body.requirementType || 'package';
    const requirement_details = body.requirement_details || body.requirementDetails || {};

    const supabase = createServiceClient();

    // Duplicate detection: same phone + destination within last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dupes } = await supabase
      .from('website_enquiries')
      .select('id')
      .eq('phone', phone)
      .eq('destination', destination || '')
      .gte('created_at', sevenDaysAgo)
      .limit(1);

    if (dupes && dupes.length > 0) {
      return NextResponse.json(
        { error: 'A similar enquiry was already submitted recently. Our team will contact you soon.' },
        { status: 409, headers }
      );
    }

    // Find or create client
    let client_id: string;
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      client_id = existing.id;
    } else {
      const { data: newClient, error: clientErr } = await supabase
        .from('clients')
        .insert({ full_name: name, email, phone })
        .select('id')
        .single();
      if (clientErr || !newClient) {
        return NextResponse.json({ error: clientErr?.message || 'Failed to create client' }, { status: 500, headers });
      }
      client_id = newClient.id;
    }

    // Fetch org config for trip ID format (public route — no auth, use first org)
    const { data: orgForConfig } = await supabase
      .from('organisations')
      .select('trip_id_config')
      .limit(1)
      .single();
    const tripIdConfig = (orgForConfig?.trip_id_config as TripIdConfig) ?? DEFAULT_TRIP_ID_CONFIG;

    // Generate trip_id
    const tripId = await generateTripIdFromDb(supabase, requirementToServiceType(requirement_type), tripIdConfig);

    // Insert enquiry
    const { data: enquiry, error: enquiryErr } = await supabase
      .from('website_enquiries')
      .insert({
        client_id, name, email, phone, destination,
        travel_date, date_flexible, flexibility_days,
        adults, children, children_ages, budget_range,
        budget_type, special_requirements, whatsapp_opted,
        source, number_of_nights, hotel_category,
        requirement_type, requirement_details,
        trip_id: tripId,
      })
      .select('id')
      .single();

    if (enquiryErr || !enquiry) {
      return NextResponse.json({ error: enquiryErr?.message || 'Failed to create enquiry' }, { status: 500, headers });
    }

    // Auto-assign lead if enabled
    try {
      // Find any org with auto-assign enabled (single-tenant assumption)
      const { data: org } = await supabase
        .from('organisations')
        .select('id, auto_assign_enabled, auto_assign_strategy, auto_assign_last_agent_id')
        .eq('auto_assign_enabled', true)
        .limit(1)
        .single();

      if (org) {
        // Get all agents with capacity
        const { data: agents } = await supabase
          .from('users')
          .select('id, max_active_leads')
          .eq('role', 'agent')
          .eq('org_id', org.id);

        if (agents && agents.length > 0) {
          // Count active leads per agent
          const { data: leadCounts } = await supabase
            .from('website_enquiries')
            .select('assigned_to')
            .not('assigned_to', 'is', null)
            .in('status', ['new', 'contacted', 'qualified']);

          const countMap: Record<string, number> = {};
          (leadCounts || []).forEach(l => {
            const aid = l.assigned_to as string;
            countMap[aid] = (countMap[aid] || 0) + 1;
          });

          // Filter agents with capacity
          const available = agents.filter(a => {
            const current = countMap[a.id] || 0;
            return current < (a.max_active_leads ?? 10);
          });

          if (available.length > 0) {
            let chosen: typeof available[0];

            if (org.auto_assign_strategy === 'least_loaded') {
              // Pick agent with fewest active leads
              chosen = available.reduce((min, a) =>
                (countMap[a.id] || 0) < (countMap[min.id] || 0) ? a : min
              );
            } else {
              // Round robin: pick next agent after last assigned
              const lastIdx = org.auto_assign_last_agent_id
                ? available.findIndex(a => a.id === org.auto_assign_last_agent_id)
                : -1;
              chosen = available[(lastIdx + 1) % available.length];
            }

            // Assign the enquiry
            await supabase
              .from('website_enquiries')
              .update({ assigned_to: chosen.id })
              .eq('id', enquiry.id);

            // Update last assigned agent for round robin
            await supabase
              .from('organisations')
              .update({ auto_assign_last_agent_id: chosen.id })
              .eq('id', org.id);
          }
        }
      }
    } catch (autoAssignErr) {
      console.error('Auto-assign failed (non-fatal):', autoAssignErr);
    }

    // Send notification email
    if (process.env.GMAIL_USER) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      const rows = [
        ['Name', name],
        ['Email', email],
        ['Phone', phone],
        ['Destination', destination],
        ['Travel Date', travel_date],
        ['Date Flexible', date_flexible ? `Yes (±${flexibility_days || 0} days)` : 'No'],
        ['Adults', adults],
        ['Children', children],
        ['Children Ages', children_ages || '—'],
        ['Budget Range', budget_range || '—'],
        ['Budget Type', budget_type || '—'],
        ['Number of Nights', number_of_nights || '—'],
        ['Hotel Category', hotel_category || '—'],
        ['Special Requirements', special_requirements || '—'],
        ['WhatsApp Opted', whatsapp_opted ? 'Yes' : 'No'],
        ['Requirement Type', requirement_type],
        ['Source', source || '—'],
      ]
        .map(([label, val]) =>
          `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#666;font-weight:600;">${label}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${val}</td></tr>`
        )
        .join('');

      await transporter.sendMail({
        from: `EzTrips <${process.env.GMAIL_USER}>`,
        to: 'sudeep@eztrips.in',
        subject: `New Enquiry: ${name} → ${destination}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;">New Website Enquiry</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:24px;">
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
  </div>
</body>
</html>`.trim(),
      });
    }

    return NextResponse.json(
      { success: true, enquiry_id: enquiry.id, trip_id: tripId },
      { status: 201, headers },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
