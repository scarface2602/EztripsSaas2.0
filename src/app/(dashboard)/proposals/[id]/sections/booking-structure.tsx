'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, Layers } from 'lucide-react';
import type { Proposal } from '@/lib/types/database';

interface BookingStructureSectionProps {
  proposal: Proposal;
  updateProposal: (updates: Partial<Proposal>) => void;
}

export function BookingStructureSection({ proposal, updateProposal }: BookingStructureSectionProps) {
  const structure = proposal.booking_structure_type;

  const descriptions: Record<string, string> = {
    full_dmc:
      'Single DMC handles all components (hotels, activities, transfers, guides). One payment group with advance + balance.',
    partial_dmc:
      'DMC handles some items (guides, transfers), online vendors handle others (hotels, flights). Multiple payment groups.',
    mixed:
      'Each vendor completely separate. Each item is its own payment group. Most flexible but requires managing many payment terms.',
    undecided:
      'Not yet decided on sourcing. Will determine at booking confirmation. Uses default payment terms.',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Booking Structure
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>How are you sourcing this trip? *</Label>
          <Select value={structure || ''} onValueChange={(v) => updateProposal({ booking_structure_type: v as ('full_dmc' | 'partial_dmc' | 'mixed' | 'undecided') || null })}>
            <SelectTrigger>
              <SelectValue placeholder="Select sourcing model..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_dmc">Full DMC</SelectItem>
              <SelectItem value="partial_dmc">Partial DMC + Online Vendors</SelectItem>
              <SelectItem value="mixed">Mixed / Separate Vendors</SelectItem>
              <SelectItem value="undecided">Undecided (Decide at Booking)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This determines how payment terms will be organized at booking confirmation.
          </p>
        </div>

        {structure && (
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">{descriptions[structure]}</div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Booking Structure Notes</Label>
          <Textarea
            value={proposal.booking_structure_notes || ''}
            onChange={(e) => updateProposal({ booking_structure_notes: e.target.value })}
            placeholder="e.g., DMC is Rajasthan Tours, hotels booked directly, flights via travel portal..."
            rows={3}
          />
        </div>

        {!structure || structure === 'undecided' ? (
          <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong>Tip:</strong> Selecting a structure now will help organize payments at booking time. You can always adjust when converting the proposal.
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
