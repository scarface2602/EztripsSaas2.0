import { emailLayout, emailInfoRow } from './base';

interface ConfirmationRequestData {
  vendorName: string;
  bookingTitle: string;
  itemLabel: string;
  itemType: string;
  travelDates: string;
  clientName: string;
  paxCount?: number;
  supplierReference?: string;
  agentName: string;
  agencyName?: string;
}

export function supplierConfirmationRequestEmail(data: ConfirmationRequestData): { subject: string; html: string } {
  const subject = `Confirmation Request — ${data.itemLabel} for ${data.clientName} (${data.travelDates})`;

  const rows = [
    emailInfoRow('Booking', data.bookingTitle),
    emailInfoRow('Service', `${data.itemLabel} (${data.itemType})`),
    emailInfoRow('Dates', data.travelDates),
    emailInfoRow('Client', data.clientName),
    ...(data.paxCount ? [emailInfoRow('Pax', String(data.paxCount))] : []),
    ...(data.supplierReference ? [emailInfoRow('Reference', data.supplierReference)] : []),
  ].join('');

  const body = `
    <p>Dear ${data.vendorName},</p>
    <p>Please confirm the following booking at the earliest:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${rows}
    </table>
    <p>Please share the confirmation number once done.</p>
    <p style="margin-top:24px;">Regards,<br/><strong>${data.agentName}</strong>${data.agencyName ? `<br/>${data.agencyName}` : ''}</p>
  `;

  return {
    subject,
    html: emailLayout('Confirmation Request', body),
  };
}

interface FollowUpData extends ConfirmationRequestData {
  followupCount: number;
}

export function supplierFollowUpEmail(data: FollowUpData): { subject: string; html: string } {
  const subject = `Follow Up #${data.followupCount} — ${data.itemLabel} for ${data.clientName} (${data.travelDates})`;

  const rows = [
    emailInfoRow('Booking', data.bookingTitle),
    emailInfoRow('Service', `${data.itemLabel} (${data.itemType})`),
    emailInfoRow('Dates', data.travelDates),
    emailInfoRow('Client', data.clientName),
  ].join('');

  const body = `
    <p>Dear ${data.vendorName},</p>
    <p>This is follow-up <strong>#${data.followupCount}</strong> regarding our earlier request for confirmation:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${rows}
    </table>
    <p>Kindly expedite the confirmation.</p>
    <p style="margin-top:24px;">Regards,<br/><strong>${data.agentName}</strong>${data.agencyName ? `<br/>${data.agencyName}` : ''}</p>
  `;

  return {
    subject,
    html: emailLayout('Follow Up', body),
  };
}
