import { emailLayout, emailInfoRow, emailButton, BRAND } from './base';

interface PaymentReminderData {
  clientName: string;
  bookingTitle: string;
  destination?: string;
  travelDates: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string;
  currency: string;
  paymentLink?: string;
  agentName: string;
  agencyName?: string;
}

export function paymentReminderEmail(data: PaymentReminderData): { subject: string; html: string } {
  const cur = data.currency === 'INR' ? '\u20B9' : data.currency;
  const subject = `Payment Reminder — ${data.bookingTitle} (${cur}${data.amountDue.toLocaleString('en-IN')} due ${data.dueDate})`;

  const rows = [
    ...(data.destination ? [emailInfoRow('Destination', data.destination)] : []),
    emailInfoRow('Travel Dates', data.travelDates),
    emailInfoRow('Total Amount', `${cur}${data.totalAmount.toLocaleString('en-IN')}`),
    emailInfoRow('Paid So Far', `${cur}${data.amountPaid.toLocaleString('en-IN')}`),
    emailInfoRow('Outstanding', `<strong style="color:${BRAND.accent};">${cur}${data.amountDue.toLocaleString('en-IN')}</strong>`),
    emailInfoRow('Due Date', `<strong>${data.dueDate}</strong>`),
  ].join('');

  const paymentButton = data.paymentLink
    ? emailButton(data.paymentLink, 'Make Payment', BRAND.green)
    : '';

  const body = `
    <p>Dear ${data.clientName},</p>
    <p>This is a friendly reminder that a payment of <strong>${cur}${data.amountDue.toLocaleString('en-IN')}</strong> for your booking "<strong>${data.bookingTitle}</strong>" is due on <strong>${data.dueDate}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${rows}
    </table>
    ${paymentButton}
    <p style="font-size:0.9rem;color:#666;">If you have already made the payment, please ignore this reminder.</p>
    <p style="margin-top:24px;">Regards,<br/><strong>${data.agentName}</strong>${data.agencyName ? `<br/>${data.agencyName}` : ''}</p>
  `;

  return {
    subject,
    html: emailLayout('Payment Reminder', body, { headerBg: BRAND.accent }),
  };
}

interface BookingConfirmedData {
  clientName: string;
  bookingTitle: string;
  destination?: string;
  travelDates: string;
  paxCount?: number;
  confirmedItems: string[];
  agentName: string;
  agencyName?: string;
}

export function bookingConfirmedEmail(data: BookingConfirmedData): { subject: string; html: string } {
  const subject = `Booking Confirmed — ${data.bookingTitle}`;

  const rows = [
    emailInfoRow('Booking', data.bookingTitle),
    ...(data.destination ? [emailInfoRow('Destination', data.destination)] : []),
    emailInfoRow('Travel Dates', data.travelDates),
    ...(data.paxCount ? [emailInfoRow('Pax', String(data.paxCount))] : []),
  ].join('');

  const itemsList = data.confirmedItems.length > 0
    ? `<ul style="margin:12px 0;padding-left:20px;">${data.confirmedItems.map(i => `<li style="margin:4px 0;">${i}</li>`).join('')}</ul>`
    : '';

  const body = `
    <p>Dear ${data.clientName},</p>
    <p>Great news! Your booking has been confirmed.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${rows}
    </table>
    ${itemsList ? `<p><strong>Confirmed Items:</strong></p>${itemsList}` : ''}
    <p>We will share your vouchers shortly.</p>
    <p style="margin-top:24px;">Regards,<br/><strong>${data.agentName}</strong>${data.agencyName ? `<br/>${data.agencyName}` : ''}</p>
  `;

  return {
    subject,
    html: emailLayout('Booking Confirmed!', body, { headerBg: BRAND.green }),
  };
}
