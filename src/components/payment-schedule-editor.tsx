'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle, Plus, Trash2, Copy, Check, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentAccount, PaymentSchedulePayment } from '@/lib/types/database';

interface PaymentScheduleEditorProps {
  packageTotal: number;
  initialPayments?: PaymentSchedulePayment[];
  paymentAccounts: PaymentAccount[];
  onPaymentsChange: (payments: PaymentSchedulePayment[]) => void;
  showTemplates?: boolean;
  templateMode?: 'save' | 'load' | 'both' | 'none';
}

export function PaymentScheduleEditor({
  packageTotal,
  initialPayments = [],
  paymentAccounts,
  onPaymentsChange,
  showTemplates = false,
  templateMode = 'none',
}: PaymentScheduleEditorProps) {
  const [payments, setPayments] = useState<PaymentSchedulePayment[]>(
    initialPayments.length > 0 ? initialPayments : []
  );
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; payments: PaymentSchedulePayment[] }>>([]);

  // Calculate running balance
  const runningBalance = useMemo(() => {
    let balance = packageTotal;
    return payments.map((p) => {
      const remaining = balance - p.amount;
      balance = remaining;
      return remaining;
    });
  }, [payments, packageTotal]);

  const totalScheduled = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceRemaining = packageTotal - totalScheduled;
  const isFullyScheduled = Math.abs(balanceRemaining) < 0.01; // Allow for float rounding
  const isOverScheduled = balanceRemaining < -0.01;

  function updatePayment(index: number, field: keyof PaymentSchedulePayment, value: string | number | undefined) {
    const updated = [...payments];
    if (field === 'amount') {
      updated[index] = { ...updated[index], amount: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setPayments(updated);
    onPaymentsChange(updated);
  }

  function addPayment() {
    const nextSequence = (payments.length || 0) + 1;
    const newPayment: PaymentSchedulePayment = {
      sequence: nextSequence,
      amount: 0,
      due_date: new Date().toISOString().split('T')[0],
      reference_number: '',
    };
    const updated = [...payments, newPayment];
    setPayments(updated);
    onPaymentsChange(updated);
  }

  function removePayment(index: number) {
    const updated = payments.filter((_, i) => i !== index);
    // Recalculate sequences
    const resequenced = updated.map((p, i) => ({ ...p, sequence: i + 1 }));
    setPayments(resequenced);
    onPaymentsChange(resequenced);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    setSavingTemplate(true);
    try {
      const res = await fetch('/api/settings/payment-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          is_template: true,
          payments,
        }),
      });

      if (!res.ok) throw new Error('Save failed');

      toast.success(`Template "${templateName}" saved`);
      setTemplateName('');
      setShowSaveTemplate(false);
      loadAvailableTemplates(); // Refresh templates
    } catch (error) {
      toast.error('Failed to save template');
      console.error(error);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function loadAvailableTemplates() {
    if (!showTemplates) return;

    try {
      const res = await fetch('/api/settings/payment-schedules');
      if (!res.ok) throw new Error('Load failed');

      const data = await res.json();
      setTemplates(data.schedules?.filter((s: { is_template: boolean }) => s.is_template) || []);
    } catch (error) {
      toast.error('Failed to load templates');
      console.error(error);
    }
  }

  function applyTemplate(template: { id: string; name: string; payments: PaymentSchedulePayment[] }) {
    if (!template.payments || !Array.isArray(template.payments)) {
      toast.error('Invalid template');
      return;
    }

    // Apply template payments
    const newPayments = template.payments.map((p: PaymentSchedulePayment, idx: number) => ({
      sequence: idx + 1,
      amount: p.amount,
      due_date: p.due_date,
      reference_number: p.reference_number || '',
      paid_from_account_id: p.paid_from_account_id,
    }));

    setPayments(newPayments);
    onPaymentsChange(newPayments);
    toast.success(`Applied template "${template.name}"`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Payment Schedule for Package</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg text-sm">
            <div>
              <div className="text-muted-foreground">Total Package</div>
              <div className="font-bold">₹{packageTotal.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Scheduled</div>
              <div className="font-bold">₹{totalScheduled.toLocaleString()}</div>
            </div>
            <div>
              <div className={`text-muted-foreground`}>Remaining</div>
              <div className={`font-bold ${isOverScheduled ? 'text-red-600' : isFullyScheduled ? 'text-green-600' : 'text-orange-600'}`}>
                ₹{balanceRemaining.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {isOverScheduled && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Over-scheduled:</strong> Total payments exceed package cost by ₹{Math.abs(balanceRemaining).toLocaleString()}
              </div>
            </div>
          )}

          {!isFullyScheduled && !isOverScheduled && (
            <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Incomplete:</strong> ₹{balanceRemaining.toLocaleString()} remaining to schedule
              </div>
            </div>
          )}

          {isFullyScheduled && (
            <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Complete:</strong> All payments scheduled ✓
              </div>
            </div>
          )}

          {/* Payment Lines */}
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No payments added yet. Click &quot;Add Payment&quot; to start.
              </div>
            ) : (
              payments.map((payment, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">Payment #{payment.sequence}</div>
                    {idx > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePayment(idx)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Amount (₹) *</Label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={payment.amount}
                        onChange={(e) => updatePayment(idx, 'amount', e.target.value)}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Due Date *</Label>
                      <Input
                        type="date"
                        value={payment.due_date}
                        onChange={(e) => updatePayment(idx, 'due_date', e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Reference #</Label>
                      <Input
                        placeholder="PNR, Conf #, Invoice #"
                        value={payment.reference_number || ''}
                        onChange={(e) => updatePayment(idx, 'reference_number', e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Pay From Account</Label>
                      <Select
                        value={payment.paid_from_account_id || ''}
                        onValueChange={(v) => updatePayment(idx, 'paid_from_account_id', v || undefined)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentAccounts
                            .filter((acc) => acc.is_active)
                            .map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.account_name}
                                {acc.account_number && ` (${acc.account_number})`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Running Balance */}
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                    <span className="text-muted-foreground">
                      Remaining after payment:
                    </span>
                    <span className={`font-semibold ${runningBalance[idx] < 0 ? 'text-red-600' : ''}`}>
                      ₹{runningBalance[idx].toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap pt-2">
            <Button onClick={addPayment} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Add Payment
            </Button>

            {showTemplates && templateMode !== 'none' && (
              <>
                {templateMode !== 'load' && (
                  <Button
                    onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                    variant="outline"
                    className="gap-2"
                    disabled={payments.length === 0}
                  >
                    <Copy className="h-4 w-4" /> Save as Template
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Save Template Form */}
          {showSaveTemplate && (
            <div className="p-3 border rounded-lg bg-blue-50 space-y-2">
              <Label className="text-sm font-semibold">Template Name</Label>
              <Input
                placeholder="e.g., DMC Standard, Hotel Vendor"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                >
                  Save Template
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveTemplate(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Templates List */}
          {showTemplates && templateMode !== 'none' && templates.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <Label className="text-sm font-semibold">Available Templates</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    onClick={() => applyTemplate(template)}
                    className="h-auto p-2 text-left justify-start"
                  >
                    <div className="text-xs">
                      <div className="font-semibold">{template.name}</div>
                      <div className="text-muted-foreground">
                        {template.payments?.length || 0} payments
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
