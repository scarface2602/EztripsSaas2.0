import nodemailer from 'nodemailer';
import { emailLayout } from '../email/base';

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

  const body = `
    <p style="margin-top:0;">Hello ${customerName},</p>
    <p>Please find your <strong>${typeLabel} Voucher</strong> for <strong>${supplierName}</strong> attached to this email.</p>
    <p>Present this voucher at the time of check-in or service. If you have any questions, please contact us directly.</p>`;

  await transporter.sendMail({
    from: `${orgName} <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your ${typeLabel} Voucher — ${supplierName}`,
    html: emailLayout(orgName, body, { footerOrg: orgName }),
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
