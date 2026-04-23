'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader2, X } from 'lucide-react';

type ImageItem = { name: string; url: string; created_at: string };

export default function ImagePicker({
  value,
  onChange,
  label = 'Image',
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<'url' | 'upload' | 'gallery'>('url');
  const [urlInput, setUrlInput] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [gallery, setGallery] = useState<ImageItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const loadGallery = useCallback(async () => {
    setLoadingGallery(true);
    try {
      const res = await fetch('/api/website/cms/images');
      if (res.ok) setGallery(await res.json());
    } finally {
      setLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    if (dialogOpen && tab === 'gallery' && gallery.length === 0) loadGallery();
  }, [dialogOpen, tab, gallery.length, loadGallery]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/website/cms/images', { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        onChange(url);
        setDialogOpen(false);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-1">
        {value && (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border bg-muted shrink-0">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => onChange('')}
              className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <ImageIcon className="h-4 w-4 mr-2" /> {value ? 'Change' : 'Select Image'}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Image</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 border-b pb-3">
            {(['url', 'upload', 'gallery'] as const).map(t => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? 'default' : 'outline'}
                onClick={() => setTab(t)}
                className="capitalize"
              >
                {t === 'url' && <LinkIcon className="h-3 w-3 mr-1" />}
                {t === 'upload' && <Upload className="h-3 w-3 mr-1" />}
                {t === 'gallery' && <ImageIcon className="h-3 w-3 mr-1" />}
                {t}
              </Button>
            ))}
          </div>

          {tab === 'url' && (
            <div className="space-y-3">
              <Input
                placeholder="https://example.com/image.jpg"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
              />
              {urlInput && (
                <img src={urlInput} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
              )}
              <Button
                onClick={() => { onChange(urlInput); setDialogOpen(false); }}
                disabled={!urlInput}
                className="w-full"
              >
                Use This URL
              </Button>
            </div>
          )}

          {tab === 'upload' && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:border-primary transition-colors">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload an image</span>
                    <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP up to 5MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </label>
            </div>
          )}

          {tab === 'gallery' && (
            <div>
              {loadingGallery ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : gallery.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No images uploaded yet</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {gallery.map(img => (
                    <button
                      key={img.name}
                      onClick={() => { onChange(img.url); setDialogOpen(false); }}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 hover:border-primary transition-colors"
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
