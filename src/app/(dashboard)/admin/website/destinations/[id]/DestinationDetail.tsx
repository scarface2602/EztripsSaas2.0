'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import ImagePicker from '@/components/cms/ImagePicker';
import {
  Save, ArrowLeft, Plus, Pencil, Trash2, Package, Eye, EyeOff,
} from 'lucide-react';

type Dest = Record<string, unknown>;
type Pkg = Record<string, unknown>;

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function DestinationDetail({
  destination,
  packages: initialPackages,
}: {
  destination: Dest | null;
  packages: Pkg[];
}) {
  const router = useRouter();
  const isNew = !destination;
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<Pkg[]>(initialPackages);

  // Destination fields
  const [title, setTitle] = useState((destination?.title as string) || '');
  const [slug, setSlug] = useState((destination?.slug as string) || '');
  const [tagline, setTagline] = useState((destination?.tagline as string) || '');
  const [description, setDescription] = useState((destination?.description as string) || '');
  const [country, setCountry] = useState((destination?.country as string) || '');
  const [region, setRegion] = useState((destination?.region as string) || '');
  const [tags, setTags] = useState(((destination?.tags as string[]) || []).join(', '));
  const [coverImage, setCoverImage] = useState((destination?.cover_image as string) || '');
  const [published, setPublished] = useState((destination?.published as boolean) || false);
  const [isPilgrimage, setIsPilgrimage] = useState((destination?.is_pilgrimage as boolean) || false);
  const [sortOrder, setSortOrder] = useState<number>((destination?.sort_order as number) || 0);

  async function handleSave() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      title, slug, tagline, description, country, region,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      cover_image: coverImage || null,
      published, is_pilgrimage: isPilgrimage,
      sort_order: sortOrder,
    };

    try {
      if (isNew) {
        const res = await fetch('/api/website/cms/destinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          router.push(`/admin/website/destinations/${created.id}`);
        }
      } else {
        const res = await fetch('/api/website/cms/destinations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: destination!.id, ...payload }),
        });
        if (res.ok) router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePackagePublished(pkg: Pkg) {
    const newVal = !pkg.published;
    const res = await fetch('/api/website/cms/packages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pkg.id, published: newVal }),
    });
    if (res.ok) {
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, published: newVal } : p));
    }
  }

  async function deletePackage(id: string) {
    if (!confirm('Delete this package?')) return;
    const res = await fetch(`/api/website/cms/packages?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPackages(prev => prev.filter(p => p.id !== id));
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[
        { label: 'Destinations', href: '/admin/website/destinations' },
        { label: title || 'New Destination' },
      ]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/website/destinations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{isNew ? 'New Destination' : title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full">
            <Switch checked={published} onCheckedChange={setPublished} id="dest-pub" />
            <Label htmlFor="dest-pub" className="text-sm cursor-pointer">
              {published ? 'Published' : 'Draft'}
            </Label>
          </div>
          <Button onClick={handleSave} disabled={saving || !title}>
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Destination Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Destination Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (isNew) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Kashmir"
              />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="Auto-generated from name" />
            </div>
          </div>
          <div>
            <Label>Tagline</Label>
            <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Paradise on Earth" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description of the destination..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Country</Label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. India" />
            </div>
            <div>
              <Label>Region</Label>
              <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. South Asia" />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Tags (comma separated)</Label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. mountains, honeymoon, adventure" />
          </div>
          <div className="flex items-center gap-4">
            <ImagePicker value={coverImage} onChange={setCoverImage} label="Cover Image" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isPilgrimage} onCheckedChange={setIsPilgrimage} id="pilgrimage" />
            <Label htmlFor="pilgrimage" className="cursor-pointer">Pilgrimage destination</Label>
          </div>
        </CardContent>
      </Card>

      {/* Packages Section */}
      {!isNew && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" /> Packages under {title}
              </CardTitle>
              <Button
                size="sm"
                onClick={() => router.push(`/admin/website/packages/new?destination=${slug}&destination_name=${encodeURIComponent(title)}`)}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Package
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {packages.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No packages yet for this destination. Click &quot;Add Package&quot; to create one.
              </p>
            ) : (
              <div className="space-y-3">
                {packages.map(pkg => (
                  <div
                    key={pkg.id as string}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pkg.title as string}</span>
                        <Badge variant={pkg.published ? 'default' : 'secondary'} className="text-xs">
                          {pkg.published ? 'Live' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pkg.nights ? `${pkg.nights}N` : ''}{pkg.duration_days ? `/${pkg.duration_days}D` : ''}
                        {Number(pkg.price_3star) > 0 && ` · From ₹${Number(pkg.price_3star).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => togglePackagePublished(pkg)}
                        title={pkg.published ? 'Unpublish' : 'Publish'}
                      >
                        {pkg.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => router.push(`/admin/website/packages/${pkg.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => deletePackage(pkg.id as string)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
