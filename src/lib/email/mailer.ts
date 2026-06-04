import nodemailer from 'nodemailer';
import { emailLayout, emailButton, emailInfoRow, BRAND } from './base';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eztrips-saas.vercel.app';

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

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
  if (!process.env.GMAIL_USER) return;
  const transporter = createTransport();
  const fullUrl = shareUrl.startsWith('http') ? shareUrl : `${APP_URL}${shareUrl}`;

  const body = `
    <p style="margin-top:0;">Hello ${clientName},</p>
    <p>Your travel proposal for <strong>${destination}</strong> is ready.</p>
    <p style="background:#f8fafc;padding:12px 16px;border-left:3px solid ${BRAND.navy};font-style:italic;">${proposalTitle}</p>
    <p>Click below to view your proposal, review all details, and confirm your booking:</p>
    ${emailButton(fullUrl, 'View My Proposal')}
    <p style="font-size:0.85rem;color:#666;">
      Or copy this link: <a href="${fullUrl}" style="color:${BRAND.navy};">${fullUrl}</a>
    </p>`;

  await transporter.sendMail({
    from: `EzTrips <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your travel proposal is ready — ${proposalTitle}`,
    html: emailLayout(agencyName || agentName, body, {
      footerOrg: agencyName || 'EzTrips',
      footerExtra: `Prepared by ${agentName}`,
    }),
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
  if (!process.env.GMAIL_USER) return;
  const transporter = createTransport();
  const dashboardUrl = `${APP_URL}/proposals/${proposalId}`;
  const cur = currency === 'INR' ? '\u20B9' : currency;

  const body = `
    <p style="margin-top:0;">Hi ${agentName},</p>
    <p><strong>${clientName}</strong> has confirmed their booking.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${emailInfoRow('Proposal', proposalTitle)}
      ${emailInfoRow('Destination', destination)}
      <tr>
        <td style="padding:8px 4px;color:#666;width:140px;">Grand Total</td>
        <td style="padding:8px 4px;font-weight:700;font-size:1.1rem;">${cur}${grandTotal.toLocaleString('en-IN')}</td>
      </tr>
    </table>
    <p>Receivables and payables have been automatically generated. Log in to manage the booking:</p>
    ${emailButton(dashboardUrl, 'Open Proposal', BRAND.green)}`;

  await transporter.sendMail({
    from: `EzTrips <${process.env.GMAIL_USER}>`,
    to,
    subject: `Proposal confirmed — ${clientName} | ${proposalTitle}`,
    html: emailLayout('Booking Confirmed!', body, { headerBg: BRAND.green }),
  });
}

/** Generic send — used by ops actions, reminders, etc. */
export async function sendEmail(to: string, subject: string, html: string) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `EzTrips <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

/** Send with attachments — used by email composer */
export async function sendEmailWithAttachments(opts: {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `EzTrips <${process.env.GMAIL_USER}>`,
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}
