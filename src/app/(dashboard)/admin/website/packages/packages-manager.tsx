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

type Pkg = Record<string, unknown>;

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  subtitle: z.string().optional(),
  destination: z.string().optional(),
  duration_days: z.coerce.number().optional(),
  price_from: z.coerce.number().optional(),
  cover_image: z.string().optional(),
  highlights: z.string().optional(),
  inclusions: z.string().optional(),
  exclusions: z.string().optional(),
  published: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function linesToArray(str: string | undefined): string[] {
  return str ? str.split('\n').map(l => l.trim()).filter(Boolean) : [];
}

function arrayToLines(arr: unknown): string {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

export default function PackagesManager({ initialData }: { initialData: Pkg[] }) {
  const [packages, setPackages] = useState<Pkg[]>(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { published: false },
  });

  function openNew() {
    setEditing(null);
    reset({ title: '', slug: '', subtitle: '', destination: '', duration_days: undefined, price_from: undefined, cover_image: '', highlights: '', inclusions: '', exclusions: '', published: false });
    setSheetOpen(true);
  }

  function openEdit(pkg: Pkg) {
    setEditing(pkg);
    reset({
      title: pkg.title as string || '',
      slug: pkg.slug as string || '',
      subtitle: pkg.subtitle as string || '',
      destination: pkg.destination as string || '',
      duration_days: pkg.duration_days as number || undefined,
      price_from: pkg.price_from as number || undefined,
      cover_image: pkg.cover_image as string || '',
      highlights: arrayToLines(pkg.highlights),
      inclusions: arrayToLines(pkg.inclusions),
      exclusions: arrayToLines(pkg.exclusions),
      published: pkg.published as boolean || false,
    });
    setSheetOpen(true);
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      highlights: linesToArray(data.highlights),
      inclusions: linesToArray(data.inclusions),
      exclusions: linesToArray(data.exclusions),
    };

    if (editing) {
      const res = await fetch('/api/website/cms/packages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPackages(prev => prev.map(p => p.id === editing.id ? updated : p));
        setSheetOpen(false);
      }
    } else {
      const res = await fetch('/api/website/cms/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setPackages(prev => [created, ...prev]);
        setSheetOpen(false);
      }
    }
  }

  async function togglePublished(pkg: Pkg) {
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

  async function handleDelete(id: string) {
    if (!confirm('Delete this package?')) return;
    const res = await fetch(`/api/website/cms/packages?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPackages(prev => prev.filter(p => p.id !== id));
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Package</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(pkg => (
          <Card key={pkg.id as string}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{pkg.title as string}</h3>
                  <p className="text-sm text-muted-foreground">
                    {pkg.destination as string}{pkg.duration_days ? ` · ${pkg.duration_days}D` : ''}
                  </p>
                </div>
                <Badge variant={pkg.published ? 'default' : 'secondary'}>
                  {pkg.published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              {pkg.price_from && (
                <p className="text-sm">From <span className="font-semibold">&#8377;{Number(pkg.price_from).toLocaleString()}</span></p>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`pub-${pkg.id}`} className="text-xs">Published</Label>
                  <Switch
                    id={`pub-${pkg.id}`}
                    checked={pkg.published as boolean}
                    onCheckedChange={() => togglePublished(pkg)}
                  />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(pkg)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(pkg.id as string)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {packages.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">No packages yet. Add your first one.</p>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit Package' : 'Add Package'}</SheetTitle>
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
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input {...register('subtitle')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destination</Label>
                <Input {...register('destination')} />
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Input {...register('duration_days')} type="number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price From (INR)</Label>
                <Input {...register('price_from')} type="number" />
              </div>
              <div>
                <Label>Cover Image URL</Label>
                <Input {...register('cover_image')} />
              </div>
            </div>
            <div>
              <Label>Highlights (one per line)</Label>
              <Textarea {...register('highlights')} rows={4} placeholder="Airport pickup included&#10;All meals included&#10;Guided tours" />
            </div>
            <div>
              <Label>Inclusions (one per line)</Label>
              <Textarea {...register('inclusions')} rows={4} />
            </div>
            <div>
              <Label>Exclusions (one per line)</Label>
              <Textarea {...register('exclusions')} rows={4} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={watch('published')}
                onCheckedChange={(val) => setValue('published', val)}
              />
              <Label>Published</Label>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Update' : 'Create'} Package</Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
