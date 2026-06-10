import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/mailer';

export const runtime = 'nodejs';

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return false;
  return true;
}

const OPEN_STATUSES = ['new', 'contacted', 'qualified'];

/**
 * First-response SLA sweep. A lead with no logged activity past the org's
 * lead_sla_minutes window is stamped sla_breached_at and managers get one
 * consolidated alert email per sweep — never one email per lead.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from('organisations')
    .select('lead_sla_minutes')
    .limit(1)
    .maybeSingle();
  const slaMinutes = org?.lead_sla_minutes ?? 30;

  const cutoff = new Date(Date.now() - slaMinutes * 60 * 1000).toISOString();

  const { data: breached, error } = await supabase
    .from('website_enquiries')
    .select('id, trip_id, name, phone, destination, assigned_to, created_at, users:assigned_to(full_name)')
    .is('first_responded_at', null)
    .is('sla_breached_at', null)
    .in('status', OPEN_STATUSES)
    .lt('created_at', cutoff);

  if (error) {
    console.error('lead-sla query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!breached || breached.length === 0) {
    return NextResponse.json({ status: 'ok', breached: 0 });
  }

  const now = new Date().toISOString();
  await supabase
    .from('website_enquiries')
    .update({ sla_breached_at: now })
    .in('id', breached.map(b => b.id));

  // One consolidated alert to managers/admins.
  const { data: managers } = await supabase
    .from('users')
    .select('email')
    .in('role', ['super_admin', 'manager']);

  const recipients = (managers || []).map(m => m.email).filter(Boolean);
  if (recipients.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eztrips-saas.vercel.app';
    const rows = breached.map(b => {
      const agent = (Array.isArray(b.users) ? b.users[0] : b.users) as { full_name: string } | null;
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace">${b.trip_id || '-'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${b.name || '-'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${b.destination || '-'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${agent?.full_name || 'Unassigned'}</td>
      </tr>`;
    }).join('');

    const html = `
      <p>${breached.length} lead(s) crossed the ${slaMinutes}-minute first-response window without a logged touch:</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr>
          <th style="padding:6px 12px;text-align:left">Trip ID</th>
          <th style="padding:6px 12px;text-align:left">Client</th>
          <th style="padding:6px 12px;text-align:left">Destination</th>
          <th style="padding:6px 12px;text-align:left">Assigned to</th>
        </tr>
        ${rows}
      </table>
      <p><a href="${appUrl}/leads">Open the enquiries board</a></p>`;

    try {
      for (const to of recipients) {
        await sendEmail(to, `⚠ ${breached.length} lead(s) breached first-response SLA`, html);
      }
    } catch (e) {
      console.error('lead-sla alert email failed:', e);
    }
  }

  return NextResponse.json({ status: 'ok', breached: breached.length });
}
