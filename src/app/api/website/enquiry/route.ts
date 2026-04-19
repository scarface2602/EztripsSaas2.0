import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

const ALLOWED_ORIGINS = [
  'https://eztrips.in',
  'http://localhost:3000',
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

  try {
    const body = await request.json();
    const {
      name, email, phone, destination,
      travel_date, date_flexible, flexibility_days,
      adults, children, children_ages, budget_range,
      budget_type, special_requirements, whatsapp_opted,
      source,
    } = body;

    const supabase = createServiceClient();

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

    // Insert enquiry
    const { data: enquiry, error: enquiryErr } = await supabase
      .from('enquiries')
      .insert({
        client_id, name, email, phone, destination,
        travel_date, date_flexible, flexibility_days,
        adults, children, children_ages, budget_range,
        budget_type, special_requirements, whatsapp_opted,
        source,
      })
      .select('id')
      .single();

    if (enquiryErr || !enquiry) {
      return NextResponse.json({ error: enquiryErr?.message || 'Failed to create enquiry' }, { status: 500, headers });
    }

    // Create draft proposal
    await supabase.from('proposals').insert({
      title: `${destination} — Website Enquiry`,
      status: 'enquiry',
      client_id,
      destination,
      travel_start: travel_date,
      adults,
      children,
    });

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
        ['Special Requirements', special_requirements || '—'],
        ['WhatsApp Opted', whatsapp_opted ? 'Yes' : 'No'],
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

    return NextResponse.json({ success: true, enquiry_id: enquiry.id }, { status: 201, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
