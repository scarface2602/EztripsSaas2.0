'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface AIAutoFillModalProps {
  open: boolean;
  onClose: () => void;
  proposalId: string;
  onDataParsed: (data: Record<string, unknown>) => void;
}

export function AIAutoFillModal({ open, onClose, proposalId, onDataParsed }: AIAutoFillModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleParse() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/quotes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, proposal_id: proposalId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Parse failed');
      }
      const { parsed } = await res.json();
      if (parsed) {
        onDataParsed(parsed);
        toast.success('Quote data parsed and applied!');
        onClose();
        setText('');
      } else {
        toast.error('No data extracted from text');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to parse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Auto-Fill
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Paste quote / itinerary text</Label>
            <textarea
              className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              placeholder="Paste the full supplier quote, WhatsApp message, or email text here. AI will extract hotels, flights, pricing, and itinerary data..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">{text.length} characters</p>
          </div>
          <Button onClick={handleParse} disabled={loading || !text.trim()} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Parse & Auto-Fill
          </Button>
        </div>
      </div>
    </div>
  );
}
