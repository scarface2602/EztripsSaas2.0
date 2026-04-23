'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type Destination = Record<string, unknown>;

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  tagline: z.string().optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  tags: z.string().optional(),
  cover_image: z.string().optional(),
  duration_days: z.coerce.number().optional(),
  price_from: z.coerce.number().optional(),
  is_pilgrimage: z.boolean().optional().default(false),
  published: z.boolean().optional().default(false),
});

type FormData = z.infer<typeof schema>;

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function DestinationsManager({ initialData }: { initialData: Destination[] }) {
  const [destinations, setDestinations] = useState<Destination[]>(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Destination | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { is_pilgrimage: false, published: false },
  });

  function openNew() {
    setEditing(null);
    reset({ title: '', slug: '', tagline: '', description: '', country: '', region: '', tags: '', cover_image: '', duration_days: undefined, price_from: undefined, is_pilgrimage: false, published: false });
    setSheetOpen(true);
  }

  function openEdit(dest: Destination) {
    setEditing(dest);
    reset({
      title: dest.title as string || '',
      slug: dest.slug as string || '',
      tagline: dest.tagline as string || '',
      description: dest.description as string || '',
      country: dest.country as string || '',
      region: dest.region as string || '',
      tags: ((dest.tags as string[]) || []).join(', '),
      cover_image: dest.cover_image as string || '',
      duration_days: dest.duration_days as number || undefined,
      price_from: dest.price_from as number || undefined,
      is_pilgrimage: dest.is_pilgrimage as boolean || false,
      published: dest.published as boolean || false,
    });
    setSheetOpen(true);
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    if (editing) {
      const res = await fetch('/api/website/cms/destinations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDestinations(prev => prev.map(d => d.id === editing.id ? updated : d));
        setSheetOpen(false);
      }
    } else {
      const res = await fetch('/api/website/cms/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setDestinations(prev => [created, ...prev]);
        setSheetOpen(false);
      }
    }
  }

  async function togglePublished(dest: Destination) {
    const newVal = !dest.published;
    const res = await fetch('/api/website/cms/destinations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dest.id, published: newVal }),
    });
    if (res.ok) {
      setDestinations(prev => prev.map(d => d.id === dest.id ? { ...d, published: newVal } : d));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this destination?')) return;
    const res = await fetch(`/api/website/cms/destinations?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDestinations(prev => prev.filter(d => d.id !== id));
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Destination</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {destinations.map(dest => (
          <Card key={dest.id as string}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{dest.title as string}</h3>
                  <p className="text-sm text-muted-foreground">{dest.country as string}{dest.region ? ` · ${dest.region}` : ''}</p>
                </div>
                <Badge variant={dest.published ? 'default' : 'secondary'}>
                  {dest.published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              {Number(dest.price_from) > 0 && (
                <p className="text-sm">From <span className="font-semibold">&#8377;{Number(dest.price_from).toLocaleString()}</span></p>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`pub-${dest.id}`} className="text-xs">Published</Label>
                  <Switch
                    id={`pub-${dest.id}`}
                    checked={dest.published as boolean}
                    onCheckedChange={() => togglePublished(dest)}
                  />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(dest)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(dest.id as string)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {destinations.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">No destinations yet. Add your first one.</p>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit Destination' : 'Add Destination'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <div>
              <Label>Title *</Label>
              <Input {...register('title')} onChange={(e) => {
                register('title').onChange(e);
                if (!editing) setValue('slug', slugify(e.target.value));
              }} />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label>Slug *</Label>
              <Input {...register('slug')} />
              {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
            </div>
            <div>
              <Label>Tagline</Label>
              <Input {...register('tagline')} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea {...register('description')} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country</Label>
                <Input {...register('country')} />
              </div>
              <div>
                <Label>Region</Label>
                <Input {...register('region')} />
              </div>
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input {...register('tags')} placeholder="beach, family, adventure" />
            </div>
            <div>
              <Label>Cover Image URL</Label>
              <Input {...register('cover_image')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duration (days)</Label>
                <Input {...register('duration_days')} type="number" />
              </div>
              <div>
                <Label>Price From (INR)</Label>
                <Input {...register('price_from')} type="number" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={watch('is_pilgrimage')}
                  onCheckedChange={(val) => setValue('is_pilgrimage', val)}
                />
                <Label>Pilgrimage</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={watch('published')}
                  onCheckedChange={(val) => setValue('published', val)}
                />
                <Label>Published</Label>
              </div>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Update' : 'Create'} Destination</Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
