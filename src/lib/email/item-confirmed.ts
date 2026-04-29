import nodemailer from 'nodemailer';
import { emailLayout, emailInfoRow, BRAND } from './base';

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

export async function sendItemConfirmedEmail({
  to,
  customerName,
  itemType,
  itemLabel,
  destination,
  supplierReference,
  startDate,
  agencyName,
}: {
  to: string;
  customerName: string;
  itemType: string;
  itemLabel: string;
  destination: string;
  supplierReference: string | null;
  startDate: string | null;
  agencyName?: string;
}) {
  if (!process.env.GMAIL_USER) return;

  const typeLabel = {
    flight_segment: 'Flight',
    hotel_room: 'Hotel',
    transfer: 'Transfer',
    activity: 'Activity',
    meal_plan: 'Meal Plan',
  }[itemType] || itemType;

  const body = `
    <p style="margin-top:0;">Hello ${customerName},</p>
    <p>Great news! Your <strong>${typeLabel.toLowerCase()}</strong> for <strong>${destination}</strong> has been confirmed.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${emailInfoRow('Item', itemLabel)}
      ${supplierReference ? emailInfoRow('Reference', `<span style="font-family:monospace;font-weight:600;">${supplierReference}</span>`) : ''}
      ${startDate ? emailInfoRow('Date', startDate) : ''}
      ${emailInfoRow('Destination', destination)}
    </table>
    <p style="font-size:0.85rem;color:#666;">If you have any questions, please contact us directly.</p>`;

  const transporter = createTransport();
  await transporter.sendMail({
    from: `EzTrips <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your ${typeLabel} for ${destination} is confirmed`,
    html: emailLayout('Booking Confirmed', body, {
      headerBg: BRAND.green,
      footerOrg: agencyName || 'EzTrips',
    }),
  });
}
