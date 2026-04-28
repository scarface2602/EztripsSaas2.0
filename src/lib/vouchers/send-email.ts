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

export async function sendVoucherEmail({
  to,
  customerName,
  supplierType,
  supplierName,
  pdfBuffer,
  orgName,
}: {
  to: string;
  customerName: string;
  supplierType: string;
  supplierName: string;
  pdfBuffer: Buffer;
  orgName: string;
}) {
  if (!process.env.GMAIL_USER) throw new Error('GMAIL_USER not configured');

  const transporter = createTransport();
  const typeLabel = supplierType.charAt(0).toUpperCase() + supplierType.slice(1);
  const filename = `${typeLabel}_Voucher_${supplierName.replace(/\s+/g, '_')}.pdf`;

  await transporter.sendMail({
    from: `${orgName} <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your ${typeLabel} Voucher — ${supplierName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:1.3rem;">${orgName}</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:28px 24px;">
    <p style="margin-top:0;">Hello ${customerName},</p>
    <p>Please find your <strong>${typeLabel} Voucher</strong> for <strong>${supplierName}</strong> attached to this email.</p>
    <p>Present this voucher at the time of check-in or service. If you have any questions, please contact us directly.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
    <p style="margin:0;font-size:0.85rem;color:#888;">
      ${orgName} — Travel Management
    </p>
  </div>
</body>
</html>`.trim(),
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
