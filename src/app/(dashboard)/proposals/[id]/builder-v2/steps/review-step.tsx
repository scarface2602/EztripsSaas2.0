'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ExternalLink } from 'lucide-react';
import type { BuilderData } from '../types';
import type { rollupTotals } from '../types';

interface ReviewStepProps {
  data: BuilderData;
  totals: ReturnType<typeof rollupTotals>;
  proposalId: string;
  save: () => Promise<void>;
}

export function ReviewStep({ data, totals, proposalId, save }: ReviewStepProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cur = data.proposal.currency;
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const destinations = [...data.destinations].filter((d) => d.nights > 0).sort((a, b) => a.sort_order - b.sort_order);
  const stays = data.items.filter((i) => i.item_type === 'hotel');
  const extras = data.items.filter((i) => i.item_type !== 'hotel' && i.title.trim());

  const problems: string[] = [];
  if (!data.proposal.client_id) problems.push('No customer selected');
  if (destinations.length === 0) problems.push('No cities added');
  if (totals.sell <= 0) problems.push('Nothing is priced yet');
  const unnamedStays = stays.filter((s) => s.title.startsWith('Hotel in '));
  if (unnamedStays.length > 0) problems.push(`${unnamedStays.length} stay(s) still have no hotel picked`);

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      await save();
      const res = await fetch(`/api/proposals/${proposalId}/v2/publish`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Publish failed');
      setShareUrl(body.share_url ?? null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{data.proposal.title ?? 'Untitled proposal'}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {destinations.map((d) => `${d.nights}N ${d.city_name}`).join(' + ') || 'No route yet'}
            {data.proposal.travel_start && ` · ${data.proposal.travel_start} → ${data.proposal.travel_end}`}
            {' · '}{data.proposal.pax_adults} adult(s){data.proposal.pax_children > 0 && `, ${data.proposal.pax_children} child(ren)`}
          </p>
          <div>
            <h4 className="font-medium mb-1">Stays</h4>
            {stays.length === 0 && <p className="text-muted-foreground">None</p>}
            {stays.map((s) => {
              const details = s.details as { room_type?: string; meal_plan?: string };
              return (
                <p key={s.id} className="text-muted-foreground">
                  {s.title} — {s.nights}N{details.room_type && `, ${details.room_type}`}{details.meal_plan && `, ${details.meal_plan}`}
                </p>
              );
            })}
          </div>
          {extras.length > 0 && (
            <div>
              <h4 className="font-medium mb-1">Travel &amp; extras</h4>
              {extras.map((i) => (
                <p key={i.id} className="text-muted-foreground">{i.title} ({i.item_type})</p>
              ))}
            </div>
          )}
          <div>
            <h4 className="font-medium mb-1">Pricing</h4>
            {data.groups.map((g) => (
              <p key={g.id} className="text-muted-foreground">
                {g.name}{g.supplier_name && ` — ${g.supplier_name}`}: {cur} {fmt(g.sell_amount)}
              </p>
            ))}
            {data.items.filter((i) => !i.price_group_id && i.sell_amount != null).map((i) => (
              <p key={i.id} className="text-muted-foreground">{i.title}: {cur} {fmt(i.sell_amount ?? 0)}</p>
            ))}
            <p className="text-muted-foreground mt-1">
              Land {cur} {fmt(totals.landSell)} · Flights {cur} {fmt(totals.flightSell)}
            </p>
            <p className="font-semibold">
              Grand total {cur} {fmt(totals.grand)}
              {totals.perPerson != null && ` (${cur} ${fmt(totals.perPerson)}/pax)`}
            </p>
          </div>
        </CardContent>
      </Card>

      {problems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-900">
            <ul className="list-disc ml-4 space-y-0.5">
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={() => void publish()} disabled={publishing || destinations.length === 0}>
          {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Publish &amp; get share link
        </Button>
        {shareUrl && (
          <a href={shareUrl} target="_blank" rel="noreferrer" className="text-sm text-primary flex items-center gap-1">
            <ExternalLink className="h-4 w-4" /> Open share link
          </a>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
