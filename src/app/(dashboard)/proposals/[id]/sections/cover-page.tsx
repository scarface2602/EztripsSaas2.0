'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Proposal } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Wand2, Check, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface CoverPageSectionProps {
  proposal: Proposal;
  updateProposal: (updates: Partial<Proposal>) => void;
}

export function CoverPageSection({ proposal, updateProposal }: CoverPageSectionProps) {
  const [suggestedImages, setSuggestedImages] = useState<{ url: string; alt: string }[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${proposal.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('proposal-images')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        console.error('Cover image upload error:', uploadError.message);
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from('proposal-images').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Persist immediately via PATCH
      const patchRes = await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cover_image_url: publicUrl,
          cover_image_source: 'curated',
        }),
      });

      if (!patchRes.ok) {
        toast.error('Image uploaded but failed to save URL. Try saving manually.');
      }

      updateProposal({
        cover_image_url: publicUrl,
        cover_image_source: 'curated',
        cover_image_approved_at: null,
      });

      toast.success('Cover image uploaded');
    } finally {
      setUploading(false);
    }
  }

  async function handleSuggestImages() {
    if (!proposal.destination) return;
    setLoadingImages(true);
    try {
      const res = await fetch('/api/images/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: proposal.destination }),
      });
      const data = await res.json();
      setSuggestedImages(data.images || []);
    } finally {
      setLoadingImages(false);
    }
  }

  function selectImage(url: string, source: 'ai_suggested' | 'curated') {
    updateProposal({
      cover_image_url: url,
      cover_image_source: source,
      cover_image_approved_at: null,
    });
  }

  function approveImage() {
    updateProposal({
      cover_image_source: 'approved',
      cover_image_approved_at: new Date().toISOString(),
    });
  }

  const imageStatus = proposal.cover_image_source;

  return (
    <Card>
      <CardHeader><CardTitle>Cover Page</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Trip Title</Label>
          <Input
            value={proposal.title || ''}
            onChange={(e) => updateProposal({ title: e.target.value })}
            placeholder="Enter trip title..."
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Hero Image</Label>
            <div className="flex gap-2">
              {imageStatus && (
                <Badge className={
                  imageStatus === 'curated' || imageStatus === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }>
                  {imageStatus === 'curated' ? 'Curated' : imageStatus === 'approved' ? 'Approved' : 'Review needed'}
                </Badge>
              )}
            </div>
          </div>

          {proposal.cover_image_url && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proposal.cover_image_url}
                alt="Cover"
                className="w-full h-64 object-cover rounded-lg"
              />
              {imageStatus === 'ai_suggested' && (
                <Button
                  className="absolute bottom-3 right-3"
                  size="sm"
                  onClick={approveImage}
                >
                  <Check className="h-4 w-4 mr-1" /> Approve Image
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
              />
              <Button variant="outline" className="w-full pointer-events-none" tabIndex={-1}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload Image
              </Button>
            </div>
            <Button variant="outline" onClick={handleSuggestImages} disabled={loadingImages || !proposal.destination}>
              {loadingImages ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
              AI Suggest
            </Button>
          </div>

          {suggestedImages.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {suggestedImages.map((img, i) => (
                <div
                  key={i}
                  className="cursor-pointer rounded-lg overflow-hidden border-2 hover:border-primary transition-colors"
                  onClick={() => selectImage(img.url, 'ai_suggested')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt} className="w-full h-32 object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p>The cover page will display: company logo, trip title, destination, client name, and agent name.</p>
        </div>
      </CardContent>
    </Card>
  );
}
