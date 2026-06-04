import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

interface RouteParams {
  params: Promise<{ packageId: string; paymentId: string }>;
}

async function verifyBookingAccess(supabase: ReturnType<typeof createServiceClient>, packageId: string, userId: string, userRole: string, userOrgId: string | null) {
  const { data: pkg } = await supabase
    .from('booking_packages')
    .select('booking_id')
    .eq('id', packageId)
    .single();
  if (!pkg) return { error: 'Package not found', status: 404 };

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, created_by, title, clients(full_name)')
    .eq('id', pkg.booking_id)
    .single();
  if (!booking) return { error: 'Booking not found', status: 404 };

  // Allow: owner, super_admin, or same-org ops/accounts/manager
  if (booking.created_by !== userId && userRole !== 'super_admin') {
    if (userOrgId) {
      const { data: bookingUser } = await supabase.from('users').select('org_id').eq('id', booking.created_by).single();
      if (!bookingUser || bookingUser.org_id !== userOrgId) {
        return { error: 'Unauthorized', status: 403 };
      }
    } else {
      return { error: 'Unauthorized', status: 403 };
    }
  }

  return { booking, bookingId: pkg.booking_id };
}

// PATCH: Update a payment — supports mark-paid and field updates
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { packageId, paymentId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { approved_by, ...updateFields } = body;
    const supabase = createServiceClient();

    const access = await verifyBookingAccess(supabase, packageId, auth.user.id, auth.user.role, auth.user.org_id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { booking, bookingId } = access;

    // If marking as paid, set approval_status based on workflow
    if (updateFields.status === 'paid') {
      // Record paid_from_account_id if provided
      if (updateFields.paid_from_account_id) {
        // Snapshot the account details
        const { data: account } = await supabase
          .from('payment_accounts')
          .select('account_name, bank_name, account_type')
          .eq('id', updateFields.paid_from_account_id)
          .single();
        if (account) {
          updateFields.paid_from_account_snapshot = account;
        }
      }
    }

    // Update payment
    const { data: payment, error } = await supabase
      .from('booking_package_payments')
      .update(updateFields)
      .eq('id', paymentId)
      .eq('package_id', packageId)
      .select()
      .single();

    if (error) throw error;
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Log the payment action
    if (updateFields.status === 'paid') {
      await supabase.from('booking_logs').insert({
        booking_id: bookingId,
        user_id: auth.user.id,
        action: 'payment_marked_paid',
        details: {
          payment_id: paymentId,
          amount: payment.amount,
          payment_mode: updateFields.payment_mode || null,
          reference_number: updateFields.reference_number || null,
          paid_from_account_id: updateFields.paid_from_account_id || null,
          approved_by: approved_by || null,
        },
      });

      // Send email to approving manager if specified
      if (approved_by) {
        const { data: manager } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', approved_by)
          .single();

        if (manager?.email) {
          const clientName = (booking.clients as unknown as { full_name: string } | null)?.full_name || 'Unknown';
          try {
            const transport = createTransport();
            await transport.sendMail({
              from: process.env.GMAIL_USER,
              to: manager.email,
              subject: `Payment Recorded — ${booking.title || 'Booking'}`,
              html: `
                <h3>Payment Recorded</h3>
                <p><strong>${auth.user.full_name}</strong> has recorded a payment.</p>
                <table style="border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:4px 12px;color:#666;">Booking</td><td style="padding:4px 12px;font-weight:600;">${booking.title || bookingId}</td></tr>
                  <tr><td style="padding:4px 12px;color:#666;">Client</td><td style="padding:4px 12px;">${clientName}</td></tr>
                  <tr><td style="padding:4px 12px;color:#666;">Amount</td><td style="padding:4px 12px;font-weight:600;">₹${Number(payment.amount).toLocaleString()}</td></tr>
                  <tr><td style="padding:4px 12px;color:#666;">Mode</td><td style="padding:4px 12px;">${updateFields.payment_mode || '-'}</td></tr>
                  <tr><td style="padding:4px 12px;color:#666;">Reference</td><td style="padding:4px 12px;font-family:monospace;">${updateFields.reference_number || '-'}</td></tr>
                  <tr><td style="padding:4px 12px;color:#666;">Marked By</td><td style="padding:4px 12px;">${auth.user.full_name}</td></tr>
                </table>
                <p style="color:#666;font-size:0.9em;">Please review this payment in your dashboard.</p>
              `,
            });
          } catch (emailErr) {
            console.error('Failed to send approval email:', emailErr);
          }
        }
      }
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

// DELETE: Delete a payment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { packageId, paymentId } = await params;
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    const access = await verifyBookingAccess(supabase, packageId, auth.user.id, auth.user.role, auth.user.org_id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const { error } = await supabase
      .from('booking_package_payments')
      .delete()
      .eq('id', paymentId)
      .eq('package_id', packageId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
