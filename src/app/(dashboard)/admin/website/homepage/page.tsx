'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Plus, Trash2, Home } from 'lucide-react';
import { toast } from 'sonner';

type ContentBlock = {
  id?: string;
  section: string;
  content: Record<string, unknown>;
  published: boolean;
};

export default function HomepageCMSPage() {
  const supabase = useMemo(() => createClient(), []);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase
      .from('website_homepage_content')
      .select('*')
      .order('sort_order');
    setBlocks((data || []) as ContentBlock[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  async function saveBlock(section: string, content: Record<string, unknown>) {
    setSaving(section);
    const res = await fetch('/api/website/cms/homepage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, content }),
    });
    if (res.ok) {
      toast.success(`${section} saved`);
      fetchBlocks();
    } else {
      toast.error('Failed to save');
    }
    setSaving(null);
  }

  function getBlock(section: string): Record<string, unknown> {
    return (blocks.find(b => b.section === section)?.content || {}) as Record<string, unknown>;
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Home className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Homepage Content</h1>
      </div>
      <p className="text-sm text-muted-foreground">Edit homepage sections. Changes go live within 5 minutes.</p>

      {/* Hero Section */}
      <HeroEditor data={getBlock('hero')} saving={saving === 'hero'} onSave={(c) => saveBlock('hero', c)} />

      {/* Testimonials */}
      <TestimonialsEditor data={getBlock('testimonials')} saving={saving === 'testimonials'} onSave={(c) => saveBlock('testimonials', c)} />

      {/* Featured Itineraries */}
      <FeaturedItinerariesEditor data={getBlock('featured_itineraries')} saving={saving === 'featured_itineraries'} onSave={(c) => saveBlock('featured_itineraries', c)} />

      {/* Experience Cards */}
      <ExperienceCardsEditor data={getBlock('experience_cards')} saving={saving === 'experience_cards'} onSave={(c) => saveBlock('experience_cards', c)} />
    </div>
  );
}

function HeroEditor({ data, saving, onSave }: { data: Record<string, unknown>; saving: boolean; onSave: (c: Record<string, unknown>) => void }) {
  const [heading, setHeading] = useState((data.heading as string) || 'Travel Without The Hassle.');
  const [subheading, setSubheading] = useState((data.subheading as string) || 'Curated journeys to the world\'s most extraordinary destinations. We plan everything — you just show up.');

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Hero Section</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Heading</Label>
          <Input value={heading} onChange={e => setHeading(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Subheading</Label>
          <Textarea value={subheading} onChange={e => setSubheading(e.target.value)} rows={2} />
        </div>
        <Button onClick={() => onSave({ heading, subheading })} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Hero'}
        </Button>
      </CardContent>
    </Card>
  );
}

type Testimonial = { quote: string; author: string; location: string };

function TestimonialsEditor({ data, saving, onSave }: { data: Record<string, unknown>; saving: boolean; onSave: (c: Record<string, unknown>) => void }) {
  const [items, setItems] = useState<Testimonial[]>(
    (data.items as Testimonial[]) || [
      { quote: 'Planned our Bali honeymoon — everything was perfect.', author: 'Priya & Rahul', location: 'Bengaluru' },
    ]
  );

  function update(i: number, field: keyof Testimonial, value: string) {
    setItems(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Testimonials</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setItems([...items, { quote: '', author: '', location: '' }])}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((t, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 border rounded-md">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Quote</Label>
              <Textarea value={t.quote} onChange={e => update(i, 'quote', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Author</Label>
              <Input value={t.author} onChange={e => update(i, 'author', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Location</Label>
              <div className="flex gap-2">
                <Input value={t.location} onChange={e => update(i, 'location', e.target.value)} />
                <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button onClick={() => onSave({ items })} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Testimonials'}
        </Button>
      </CardContent>
    </Card>
  );
}

type Itinerary = { title: string; image: string; duration: string; highlights: string; price: string; slug: string };

function FeaturedItinerariesEditor({ data, saving, onSave }: { data: Record<string, unknown>; saving: boolean; onSave: (c: Record<string, unknown>) => void }) {
  const [items, setItems] = useState<Itinerary[]>(
    (data.items as Itinerary[]) || []
  );

  function update(i: number, field: keyof Itinerary, value: string) {
    setItems(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Featured Itineraries</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setItems([...items, { title: '', image: '', duration: '', highlights: '', price: '', slug: '' }])}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((t, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border rounded-md">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={t.title} onChange={e => update(i, 'title', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Image URL</Label>
              <Input value={t.image} onChange={e => update(i, 'image', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration (e.g. 7 Days)</Label>
              <Input value={t.duration} onChange={e => update(i, 'duration', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Highlights (comma-separated)</Label>
              <Input value={t.highlights} onChange={e => update(i, 'highlights', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price</Label>
              <Input value={t.price} onChange={e => update(i, 'price', e.target.value)} placeholder="₹65,000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destination Slug</Label>
              <div className="flex gap-2">
                <Input value={t.slug} onChange={e => update(i, 'slug', e.target.value)} placeholder="bali" />
                <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button onClick={() => onSave({ items })} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Itineraries'}
        </Button>
      </CardContent>
    </Card>
  );
}

type ExperienceCard = { label: string; emoji: string };

function ExperienceCardsEditor({ data, saving, onSave }: { data: Record<string, unknown>; saving: boolean; onSave: (c: Record<string, unknown>) => void }) {
  const [items, setItems] = useState<ExperienceCard[]>(
    (data.items as ExperienceCard[]) || [
      { label: 'Honeymoon', emoji: '💑' },
      { label: 'Family', emoji: '👨‍👩‍👧‍👦' },
      { label: 'Adventure', emoji: '🏔' },
      { label: 'Luxury', emoji: '✨' },
      { label: 'Group', emoji: '👥' },
      { label: 'Pilgrimage', emoji: '🙏' },
    ]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Experience Cards</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setItems([...items, { label: '', emoji: '' }])}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((c, i) => (
            <div key={i} className="flex gap-2 items-center p-2 border rounded-md">
              <Input value={c.emoji} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, emoji: e.target.value } : x))} className="w-16 text-center" />
              <Input value={c.label} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="Label" />
              <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
        <Button onClick={() => onSave({ items })} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Experience Cards'}
        </Button>
      </CardContent>
    </Card>
  );
}
