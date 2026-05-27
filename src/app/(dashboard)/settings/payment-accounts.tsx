'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, Plus, Edit2, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentAccount } from '@/lib/types/database';

export function PaymentAccountsSection() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'bank' | 'payment_gateway' | 'wallet' | 'upi'>('bank');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/payment-accounts');
      if (!res.ok) throw new Error('Failed to load accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      toast.error('Failed to load payment accounts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setAccountName('');
    setAccountNumber('');
    setAccountType('bank');
    setBankName('');
    setNotes('');
    setIsActive(true);
    setEditingId(null);
  }

  function openNewDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(account: PaymentAccount) {
    setAccountName(account.account_name);
    setAccountNumber(account.account_number || '');
    setAccountType(account.account_type as 'bank' | 'payment_gateway' | 'wallet' | 'upi');
    setBankName(account.bank_name || '');
    setNotes(account.notes || '');
    setIsActive(account.is_active);
    setEditingId(account.id);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!accountName) {
      toast.error('Account name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        account_name: accountName,
        account_number: accountNumber || null,
        account_type: accountType,
        bank_name: bankName || null,
        notes: notes || null,
        is_active: isActive,
      };

      const res = await fetch(
        editingId ? `/api/settings/payment-accounts/${editingId}` : '/api/settings/payment-accounts',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error('Save failed');

      await loadAccounts();
      toast.success(editingId ? 'Account updated' : 'Account created');
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save account');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this payment account?')) return;

    try {
      const res = await fetch(`/api/settings/payment-accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      await loadAccounts();
      toast.success('Account deleted');
    } catch (error) {
      toast.error('Failed to delete account');
      console.error(error);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <p className="text-muted-foreground">Loading payment accounts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Accounts
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button size="sm" onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-1" /> Add Account
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Account' : 'Add Payment Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input
                  placeholder="e.g., HDFC Current, Personal UPI"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select value={accountType} onValueChange={(v) => {
                  if (v) setAccountType(v as 'bank' | 'payment_gateway' | 'wallet' | 'upi');
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="payment_gateway">Payment Gateway (Razorpay, etc.)</SelectItem>
                    <SelectItem value="wallet">Digital Wallet</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {accountType === 'bank' && (
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    placeholder="e.g., HDFC, ICICI, Kotak"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Account Number (Last 4 Digits)</Label>
                <Input
                  placeholder="e.g., 1234"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.slice(0, 4))}
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground">Only last 4 digits will be stored for security</p>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes (e.g., for receiving payments)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active (can be used for payments)
                </Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  {editingId ? 'Update' : 'Create'} Account
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-3">
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No payment accounts yet. Add your first account to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <div className="flex-1">
                  <div className="font-medium">
                    {account.account_name}
                    {account.account_number && ` (ending ${account.account_number})`}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {account.account_type === 'bank' && account.bank_name
                      ? `${account.account_type} — ${account.bank_name}`
                      : account.account_type}
                    {!account.is_active && ' — Inactive'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(account)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          <strong>Account Management Tips:</strong>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-xs">
            <li>Use these accounts when setting up custom payment schedules for packages</li>
            <li>Account numbers are masked (only last 4 digits stored) for security</li>
            <li>Deactivate accounts you no longer use instead of deleting them</li>
            <li>Reorder accounts by dragging to set your preferred payment methods first</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
