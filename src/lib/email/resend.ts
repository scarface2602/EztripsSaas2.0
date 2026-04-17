import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'EzTrips <proposals@eztrips.in>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eztrips-saas.vercel.app';

export async function sendShareLinkEmail({
  to,
  clientName,
  agentName,
  agencyName,
  proposalTitle,
  destination,
  shareUrl,
}: {
  to: string;
  clientName: string;
  agentName: string;
  agencyName: string;
  proposalTitle: string;
  destination: string;
  shareUrl: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const fullUrl = shareUrl.startsWith('http') ? shareUrl : `${APP_URL}${shareUrl}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Travel Proposal: ${proposalTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:1.3rem;">${agencyName || agentName}</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:28px 24px;">
    <p style="margin-top:0;">Hello ${clientName},</p>
    <p>Your travel proposal for <strong>${destination}</strong> is ready.</p>
    <p style="background:#f8fafc;padding:12px 16px;border-left:3px solid #1e3a5f;font-style:italic;">${proposalTitle}</p>
    <p>Click below to view your proposal, review all details, and confirm your booking:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${fullUrl}"
         style="background:#1e3a5f;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">
        View My Proposal
      </a>
    </div>
    <p style="font-size:0.85rem;color:#666;">
      Or copy this link: <a href="${fullUrl}" style="color:#1e3a5f;">${fullUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
    <p style="margin:0;font-size:0.85rem;color:#888;">
      Prepared by ${agentName}${agencyName ? ` · ${agencyName}` : ''}<br/>
      If you have any questions, reply to this email or contact your agent directly.
    </p>
  </div>
</body>
</html>
    `.trim(),
  });
}

export async function sendConfirmationToAgent({
  to,
  agentName,
  clientName,
  proposalTitle,
  destination,
  grandTotal,
  currency,
  proposalId,
}: {
  to: string;
  agentName: string;
  clientName: string;
  proposalTitle: string;
  destination: string;
  grandTotal: number;
  currency: string;
  proposalId: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const dashboardUrl = `${APP_URL}/proposals/${proposalId}`;
  const cur = currency === 'INR' ? '₹' : currency;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Booking Confirmed — ${clientName}: ${proposalTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#166534;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:1.3rem;">Booking Confirmed!</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:28px 24px;">
    <p style="margin-top:0;">Hi ${agentName},</p>
    <p><strong>${clientName}</strong> has confirmed their booking.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 4px;color:#666;">Proposal</td>
        <td style="padding:8px 4px;font-weight:600;">${proposalTitle}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 4px;color:#666;">Destination</td>
        <td style="padding:8px 4px;">${destination}</td>
      </tr>
      <tr>
        <td style="padding:8px 4px;color:#666;">Grand Total</td>
        <td style="padding:8px 4px;font-weight:700;font-size:1.1rem;">${cur}${grandTotal.toLocaleString('en-IN')}</td>
      </tr>
    </table>
    <p>Receivables and payables have been automatically generated. Log in to manage the booking:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${dashboardUrl}"
         style="background:#166534;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">
        Open Proposal
      </a>
    </div>
    <p style="font-size:0.85rem;color:#888;margin:0;">EzTrips — Proposal Management</p>
  </div>
</body>
</html>
    `.trim(),
  });
}
