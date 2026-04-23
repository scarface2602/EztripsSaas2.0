'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type Pkg = Record<string, unknown>;

export default function PackagesManager({ initialData }: { initialData: Pkg[] }) {
  const [packages, setPackages] = useState<Pkg[]>(initialData);
  const router = useRouter();

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
        <Button onClick={() => router.push('/admin/website/packages/new')}>
          <Plus className="h-4 w-4 mr-2" /> Add Package
        </Button>
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
              {Number(pkg.price_from) > 0 && (
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
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/website/packages/${pkg.id}`)}>
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
    </>
  );
}
