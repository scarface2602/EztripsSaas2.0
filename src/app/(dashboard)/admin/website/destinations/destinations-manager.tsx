'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Package, Trash2 } from 'lucide-react';

type Destination = Record<string, unknown>;

export default function DestinationsManager({
  initialData,
  packageCounts,
}: {
  initialData: Destination[];
  packageCounts: Record<string, number>;
}) {
  const [destinations, setDestinations] = useState<Destination[]>(initialData);
  const router = useRouter();

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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Delete this destination and all its packages?')) return;
    const res = await fetch(`/api/website/cms/destinations?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDestinations(prev => prev.filter(d => d.id !== id));
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => router.push('/admin/website/destinations/new')}>
          <Plus className="h-4 w-4 mr-2" /> Add Destination
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {destinations.map(dest => {
          const count = packageCounts[dest.slug as string] || 0;
          return (
            <Card
              key={dest.id as string}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/admin/website/destinations/${dest.id}`)}
            >
              {typeof dest.cover_image === 'string' && dest.cover_image && (
                <div className="h-32 overflow-hidden rounded-t-lg">
                  <img
                    src={dest.cover_image as string}
                    alt={dest.title as string}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className={`${typeof dest.cover_image === 'string' && dest.cover_image ? 'pt-3' : 'pt-6'} space-y-3`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{dest.title as string}</h3>
                    <p className="text-sm text-muted-foreground">
                      {dest.country as string}{dest.region ? ` · ${dest.region}` : ''}
                    </p>
                  </div>
                  <Badge variant={dest.published ? 'default' : 'secondary'}>
                    {dest.published ? 'Live' : 'Draft'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{count} {count === 1 ? 'package' : 'packages'}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`pub-${dest.id}`}
                      checked={dest.published as boolean}
                      onCheckedChange={() => togglePublished(dest)}
                    />
                    <Label htmlFor={`pub-${dest.id}`} className="text-xs cursor-pointer">
                      {dest.published ? 'Published' : 'Draft'}
                    </Label>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, dest.id as string)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {destinations.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">No destinations yet. Add your first one.</p>
        )}
      </div>
    </>
  );
}
