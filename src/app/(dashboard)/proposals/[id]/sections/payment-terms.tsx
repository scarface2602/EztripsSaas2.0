'use client';

import type { Proposal, User, PaymentTerms } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw } from 'lucide-react';

interface PaymentTermsSectionProps {
  proposal: Proposal;
  updateProposal: (updates: Partial<Proposal>) => void;
  currentUser: User;
}

export function PaymentTermsSection({ proposal, updateProposal, currentUser }: PaymentTermsSectionProps) {
  const terms = proposal.payment_terms || { deposit_pct: 25, balance_days_before: 30, notes: '' };

  function updateTerms(updates: Partial<PaymentTerms>) {
    updateProposal({ payment_terms: { ...terms, ...updates } });
  }

  function resetToDefaults() {
    const defaults = currentUser.default_payment_terms || { deposit_pct: 25, balance_days_before: 30 };
    updateProposal({ payment_terms: defaults });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payment Terms</CardTitle>
        <Button size="sm" variant="outline" onClick={resetToDefaults}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset to Defaults
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Deposit Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={terms.deposit_pct}
                onChange={(e) => updateTerms({ deposit_pct: Number(e.target.value) })}
              />
              <span className="text-sm">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Balance Due (days before departure)</Label>
            <Input
              type="number"
              min={0}
              value={terms.balance_days_before}
              onChange={(e) => updateTerms({ balance_days_before: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Additional Notes</Label>
          <Textarea
            value={terms.notes || ''}
            onChange={(e) => updateTerms({ notes: e.target.value })}
            placeholder="Any additional payment terms..."
            rows={3}
          />
        </div>
        <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          On confirmation, receivables will be auto-generated: {terms.deposit_pct}% deposit due immediately, {100 - terms.deposit_pct}% balance due {terms.balance_days_before} days before departure.
        </div>
      </CardContent>
    </Card>
  );
}
