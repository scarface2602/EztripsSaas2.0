'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { BookingPackagePayment } from '@/lib/types/database';

interface PaymentScheduleViewProps {
  payments: BookingPackagePayment[];
  packageTotal: number;
  onEditClick?: () => void;
  onMarkPaidClick?: (paymentId: string) => void;
  onAddNoteClick?: (paymentId: string) => void;
}

export function PaymentScheduleView({
  payments,
  packageTotal,
  onEditClick,
  onMarkPaidClick,
  onAddNoteClick,
}: PaymentScheduleViewProps) {
  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => a.sequence - b.sequence),
    [payments]
  );

  const totalPaid = useMemo(
    () => sortedPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0),
    [sortedPayments]
  );

  const nextDuePayment = useMemo(
    () => sortedPayments.find((p) => p.status === 'pending' || p.status === 'due' || p.status === 'overdue'),
    [sortedPayments]
  );

  function getStatusColor(status: string) {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial_paid':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'due':
        return 'bg-orange-100 text-orange-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4" />;
      case 'due':
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  }

  function getDaysUntilDue(dueDate: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Payment Schedule</CardTitle>
          {onEditClick && (
            <Button size="sm" variant="outline" onClick={onEditClick}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg text-sm">
          <div>
            <div className="text-muted-foreground">Total Cost</div>
            <div className="font-bold">₹{packageTotal.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Paid</div>
            <div className="font-bold text-green-600">₹{totalPaid.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Outstanding</div>
            <div className="font-bold text-orange-600">
              ₹{(packageTotal - totalPaid).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Next Due Highlight */}
        {nextDuePayment && (
          <div className="p-3 border-l-4 border-orange-500 bg-orange-50 rounded">
            <div className="text-xs font-semibold text-orange-900">NEXT DUE</div>
            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="font-semibold text-orange-900">
                  Payment #{nextDuePayment.sequence}: ₹{nextDuePayment.amount.toLocaleString()}
                </div>
                <div className="text-xs text-orange-800 mt-1">
                  Due: {new Date(nextDuePayment.due_date).toLocaleDateString()}
                  {nextDuePayment.status === 'overdue'
                    ? ` (OVERDUE - ${Math.abs(getDaysUntilDue(nextDuePayment.due_date))} days)`
                    : ` (In ${getDaysUntilDue(nextDuePayment.due_date)} days)`}
                </div>
              </div>
              {onMarkPaidClick && (
                <Button
                  size="sm"
                  onClick={() => onMarkPaidClick(nextDuePayment.id)}
                  className="ml-2"
                >
                  Mark Paid
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Payment Lines */}
        <div className="space-y-2">
          {sortedPayments.map((payment) => (
            <div key={payment.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Payment #{payment.sequence}</span>
                  <Badge className={getStatusColor(payment.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(payment.status)}
                      {payment.status === 'partial_paid' ? 'Partial' : payment.status}
                    </span>
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="font-bold">₹{payment.amount.toLocaleString()}</div>
                  {payment.amount_paid && payment.amount_paid > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Paid: ₹{payment.amount_paid.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Due Date:</span>{' '}
                  <span className="font-medium">{new Date(payment.due_date).toLocaleDateString()}</span>
                </div>

                {payment.reference_number && (
                  <div>
                    <span className="text-muted-foreground">Ref:</span>{' '}
                    <span className="font-medium">{payment.reference_number}</span>
                  </div>
                )}

                {payment.paid_from_account_snapshot && (
                  <div>
                    <span className="text-muted-foreground">Pay From:</span>{' '}
                    <span className="font-medium">{payment.paid_from_account_snapshot}</span>
                  </div>
                )}

                {payment.received_in_account_snapshot && (
                  <div>
                    <span className="text-muted-foreground">Received In:</span>{' '}
                    <span className="font-medium">{payment.received_in_account_snapshot}</span>
                  </div>
                )}

                {payment.paid_date && (
                  <div>
                    <span className="text-muted-foreground">Paid On:</span>{' '}
                    <span className="font-medium">{new Date(payment.paid_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {payment.notes && (
                <div className="text-sm p-2 bg-muted rounded">
                  <span className="text-muted-foreground text-xs">Notes:</span>
                  <p className="mt-1">{payment.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              {(onMarkPaidClick || onAddNoteClick) && (
                <div className="flex gap-2 pt-2">
                  {payment.status !== 'paid' && onMarkPaidClick && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMarkPaidClick(payment.id)}
                    >
                      Mark Paid
                    </Button>
                  )}
                  {onAddNoteClick && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddNoteClick(payment.id)}
                    >
                      Add Note
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {sortedPayments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No payment schedule set up yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
