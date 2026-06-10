'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils/pricing';
import { AlertTriangle, CheckCircle2, Upload, Lock, Unlock, Send, DollarSign } from 'lucide-react';

interface ERPSupplier {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  utrRef?: string;
  paymentRequested: boolean;
}

interface ERPInstallment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  cleared: boolean;
}

interface BookingERPProps {
  activeTab: 'accounts' | 'operations' | 'sales';
  currency: string;
  travelStartDate: string;
  clientTotal: number;
  supplierNames: Array<{ id: string; name: string; amount: number }>;
  bookingId?: string;
  installmentData?: ERPInstallment[];
  supplierData?: ERPSupplier[];
  onInstallmentCleared?: (id: string) => Promise<void>;
  onSupplierPaid?: (supplierId: string, utr: string) => Promise<void>;
  onPaymentRequested?: (supplierId: string) => Promise<void>;
}

export function BookingERP({ activeTab, currency, travelStartDate, clientTotal, supplierNames, installmentData, supplierData, onInstallmentCleared, onSupplierPaid, onPaymentRequested }: BookingERPProps) {
  // ── Payment State from Props (DB-backed, no mock fallbacks) ──
  const [installments, setInstallments] = useState<ERPInstallment[]>(installmentData || []);

  const [suppliers, setSuppliers] = useState<ERPSupplier[]>(
    supplierData || supplierNames.map(s => ({
      id: s.id,
      name: s.name,
      amount: s.amount,
      paid: false,
      paymentRequested: false,
    }))
  );

  const [overrideRequested, setOverrideRequested] = useState(false);
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [vouchersReleased, setVouchersReleased] = useState(false);

  // ── Derived State ─────────────────────────────────────────
  const clientBalance = useMemo(() => {
    const totalCleared = installments.filter(i => i.cleared).reduce((s, i) => s + i.amount, 0);
    return clientTotal - totalCleared;
  }, [installments, clientTotal]);

  const canReleaseVouchers = clientBalance === 0 || overrideApproved;

  // 7-day departure alert
  const daysUntilDeparture = useMemo(() => {
    if (!travelStartDate) return Infinity;
    const diff = Math.ceil((new Date(travelStartDate).getTime() - Date.now()) / 86400000);
    return diff;
  }, [travelStartDate]);
  const showDepartureAlert = daysUntilDeparture <= 7 && daysUntilDeparture >= 0 && clientBalance > 0;

  // ── Handlers (persist via API, update local state) ───────
  async function clearInstallment(id: string) {
    if (onInstallmentCleared) {
      await onInstallmentCleared(id);
    }
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, cleared: true } : i));
  }

  async function requestPayment(supplierId: string) {
    if (onPaymentRequested) {
      await onPaymentRequested(supplierId);
    }
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, paymentRequested: true } : s));
  }

  async function markSupplierPaid(supplierId: string, utr: string) {
    if (onSupplierPaid) {
      await onSupplierPaid(supplierId, utr);
    }
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, paid: true, utrRef: utr } : s));
  }

  function releaseVouchers() {
    if (canReleaseVouchers) {
      setVouchersReleased(true);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── GLOBAL WARNING BANNER ────────────────────────────── */}
      {overrideApproved && clientBalance > 0 && (
        <div className="p-4 bg-red-600 text-white rounded-lg flex items-center gap-3 font-medium">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          WARNING: Vouchers released via Admin Override. Client balance of {formatCurrency(clientBalance, currency)} is still OVERDUE.
        </div>
      )}

      {/* ── 7-DAY RED ALERT ──────────────────────────────────── */}
      {showDepartureAlert && (
        <div className="p-4 bg-red-100 border-2 border-red-500 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-lg">Action Required</p>
            <p className="text-red-700">
              Client balance of {formatCurrency(clientBalance, currency)} is overdue.
              Departure in {daysUntilDeparture} day{daysUntilDeparture !== 1 ? 's' : ''}. Chase payment immediately.
            </p>
          </div>
        </div>
      )}

      {/* ── ACCOUNTS TAB ─────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* AR: Client Receivables */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                AR — Client Receivables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-bold">{formatCurrency(clientTotal, currency)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Balance: </span>
                  <span className={`font-bold ${clientBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(clientBalance, currency)}
                  </span>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                    <th className="py-2 px-2">Installment</th>
                    <th className="py-2 px-2">Amount</th>
                    <th className="py-2 px-2">Due Date</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst) => (
                    <tr key={inst.id} className="border-b">
                      <td className="py-2 px-2 font-medium">{inst.label}</td>
                      <td className="py-2 px-2">{formatCurrency(inst.amount, currency)}</td>
                      <td className="py-2 px-2 text-muted-foreground">{inst.dueDate}</td>
                      <td className="py-2 px-2">
                        {inst.cleared
                          ? <Badge className="bg-green-100 text-green-700">Cleared</Badge>
                          : <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                        }
                      </td>
                      <td className="py-2 px-2">
                        {!inst.cleared && (
                          <Button size="sm" variant="outline" onClick={() => clearInstallment(inst.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Payment Cleared
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* AP: Supplier Payables */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                AP — Supplier Payables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                    <th className="py-2 px-2">Supplier</th>
                    <th className="py-2 px-2">Amount</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">UTR / Evidence</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <SupplierPayRow key={s.id} supplier={s} currency={currency} onMarkPaid={markSupplierPaid} />
                  ))}
                  {suppliers.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No suppliers linked</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── OPERATIONS TAB ───────────────────────────────────── */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          {/* Supplier Checklist */}
          <Card>
            <CardHeader><CardTitle>Supplier Checklist</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                    <th className="py-2 px-2">Supplier</th>
                    <th className="py-2 px-2">Amount</th>
                    <th className="py-2 px-2">Payment Status</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="py-2 px-2 font-medium">{s.name}</td>
                      <td className="py-2 px-2">{formatCurrency(s.amount, currency)}</td>
                      <td className="py-2 px-2">
                        {s.paid
                          ? <Badge className="bg-green-100 text-green-700">Paid</Badge>
                          : s.paymentRequested
                            ? <Badge className="bg-blue-100 text-blue-700">Payment Requested</Badge>
                            : <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                        }
                      </td>
                      <td className="py-2 px-2">
                        {!s.paid && !s.paymentRequested && (
                          <Button size="sm" variant="outline" onClick={() => requestPayment(s.id)}>
                            <DollarSign className="h-3.5 w-3.5 mr-1" /> Request Payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Voucher Gatekeeper */}
          <Card>
            <CardHeader><CardTitle>Voucher Release</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Client Balance: </span>
                  <span className={`font-bold ${clientBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(clientBalance, currency)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={releaseVouchers}
                  disabled={!canReleaseVouchers || vouchersReleased}
                  className={vouchersReleased ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {vouchersReleased
                    ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Vouchers Released</>
                    : <><Send className="h-4 w-4 mr-2" /> Release Vouchers</>
                  }
                </Button>

                {!canReleaseVouchers && !overrideRequested && (
                  <Button variant="outline" onClick={() => setOverrideRequested(true)}>
                    <Lock className="h-4 w-4 mr-2" /> Request Admin Override
                  </Button>
                )}

                {overrideRequested && !overrideApproved && (
                  <Badge className="bg-amber-100 text-amber-700">Override Requested — Awaiting Admin</Badge>
                )}

                {overrideApproved && (
                  <Badge className="bg-green-100 text-green-700">
                    <Unlock className="h-3 w-3 mr-1" /> Admin Override Active
                  </Badge>
                )}
              </div>

              {!canReleaseVouchers && (
                <p className="text-xs text-muted-foreground">
                  Vouchers cannot be released until the client balance is cleared or an admin override is approved.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Admin View — visible only when override requested */}
          {overrideRequested && !overrideApproved && (
            <Card className="border-2 border-amber-300 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-800">Admin Approval Required</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-amber-700">
                  Operations has requested a voucher release override. Client balance is {formatCurrency(clientBalance, currency)}.
                </p>
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => setOverrideApproved(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve Voucher Release
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── SALES TAB ────────────────────────────────────────── */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Client Communications</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  disabled={!vouchersReleased}
                  className={vouchersReleased ? '' : 'opacity-50'}
                >
                  <Send className="h-4 w-4 mr-2" /> Send Vouchers to Client
                </Button>
                {!vouchersReleased && (
                  <span className="text-xs text-muted-foreground">
                    Vouchers must be released by Operations first.
                  </span>
                )}
                {vouchersReleased && (
                  <Badge className="bg-green-100 text-green-700">Ready to send</Badge>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Booking Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Client Total: </span>
                    <span className="font-medium">{formatCurrency(clientTotal, currency)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Balance Due: </span>
                    <span className={`font-medium ${clientBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(clientBalance, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Departure: </span>
                    <span className="font-medium">{travelStartDate || 'TBD'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vouchers: </span>
                    <span className={`font-medium ${vouchersReleased ? 'text-green-600' : 'text-amber-600'}`}>
                      {vouchersReleased ? 'Released' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Inline sub-component for supplier payment rows */
function SupplierPayRow({
  supplier,
  currency,
  onMarkPaid,
}: {
  supplier: ERPSupplier;
  currency: string;
  onMarkPaid: (id: string, utr: string) => void;
}) {
  const [utr, setUtr] = useState('');
  const [showInput, setShowInput] = useState(false);

  return (
    <tr className="border-b">
      <td className="py-2 px-2 font-medium">{supplier.name}</td>
      <td className="py-2 px-2">{formatCurrency(supplier.amount, currency)}</td>
      <td className="py-2 px-2">
        {supplier.paid
          ? <Badge className="bg-green-100 text-green-700">Paid</Badge>
          : supplier.paymentRequested
            ? <Badge className="bg-blue-100 text-blue-700">Payment Requested</Badge>
            : <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
        }
      </td>
      <td className="py-2 px-2">
        {supplier.paid ? (
          <span className="text-xs text-muted-foreground">{supplier.utrRef}</span>
        ) : showInput ? (
          <div className="flex items-center gap-2">
            <Input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="UTR / Reference"
              className="h-7 text-xs w-40"
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onMarkPaid(supplier.id, utr); setShowInput(false); }} disabled={!utr.trim()}>
              Confirm
            </Button>
          </div>
        ) : null}
      </td>
      <td className="py-2 px-2">
        {!supplier.paid && !showInput && (
          <Button size="sm" variant="outline" onClick={() => setShowInput(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Upload UTR & Mark Paid
          </Button>
        )}
      </td>
    </tr>
  );
}
