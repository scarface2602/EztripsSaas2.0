import nodemailer from 'nodemailer';

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

  const transporter = createTransport();
  await transporter.sendMail({
    from: `EzTrips <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your ${typeLabel} for ${destination} is confirmed`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#166534;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:1.3rem;">Booking Confirmed</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:28px 24px;">
    <p style="margin-top:0;">Hello ${customerName},</p>
    <p>Great news! Your <strong>${typeLabel.toLowerCase()}</strong> for <strong>${destination}</strong> has been confirmed.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 4px;color:#666;">Item</td>
        <td style="padding:8px 4px;font-weight:600;">${itemLabel}</td>
      </tr>
      ${supplierReference ? `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 4px;color:#666;">Reference</td>
        <td style="padding:8px 4px;font-family:monospace;font-weight:600;">${supplierReference}</td>
      </tr>` : ''}
      ${startDate ? `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 4px;color:#666;">Date</td>
        <td style="padding:8px 4px;">${startDate}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:8px 4px;color:#666;">Destination</td>
        <td style="padding:8px 4px;">${destination}</td>
      </tr>
    </table>
    <p style="font-size:0.85rem;color:#666;">If you have any questions, please contact us directly.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
    <p style="margin:0;font-size:0.85rem;color:#888;">${agencyName || 'EzTrips'}</p>
  </div>
</body>
</html>
    `.trim(),
  });
}
