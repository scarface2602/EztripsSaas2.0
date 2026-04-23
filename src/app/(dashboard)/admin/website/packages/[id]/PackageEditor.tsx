'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ImagePicker from '@/components/cms/ImagePicker';
import {
  Save, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
} from 'lucide-react';

type Pkg = Record<string, unknown>;
type ItineraryDay = { day: number; title: string; description: string };
type HotelEntry = {
  name: string; stars: number; location: string; image: string;
  rooms?: string; meals?: string; bed_type?: string; view?: string; category?: string;
};

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function PackageEditor({
  pkg,
  defaultDestinationSlug = '',
  defaultDestinationName = '',
}: {
  pkg: Pkg | null;
  defaultDestinationSlug?: string;
  defaultDestinationName?: string;
}) {
  const router = useRouter();
  const isNew = !pkg;
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [title, setTitle] = useState((pkg?.title as string) || '');
  const [slug, setSlug] = useState((pkg?.slug as string) || '');
  const [subtitle, setSubtitle] = useState((pkg?.subtitle as string) || '');
  const [destination] = useState((pkg?.destination as string) || defaultDestinationName);
  const [destinationSlug] = useState((pkg?.destination_slug as string) || defaultDestinationSlug);
  const [nights, setNights] = useState<number | ''>(pkg?.nights as number || '');
  const [durationDays, setDurationDays] = useState<number | ''>(pkg?.duration_days as number || '');
  const [coverImage, setCoverImage] = useState((pkg?.cover_image as string) || '');
  const [published, setPublished] = useState((pkg?.published as boolean) || false);
  const [sortOrder, setSortOrder] = useState<number>(pkg?.sort_order as number || 0);

  // Pricing
  const [price3star, setPrice3star] = useState<number | ''>(pkg?.price_3star as number || '');
  const [price4star, setPrice4star] = useState<number | ''>(pkg?.price_4star as number || '');
  const [price5star, setPrice5star] = useState<number | ''>(pkg?.price_5star as number || '');
  const [priceFrom, setPriceFrom] = useState<number | ''>(pkg?.price_from as number || '');
  const [priceValidFrom, setPriceValidFrom] = useState((pkg?.price_valid_from as string) || '');
  const [priceValidTo, setPriceValidTo] = useState((pkg?.price_valid_to as string) || '');

  // Itinerary
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(
    (pkg?.itinerary_days as ItineraryDay[]) || []
  );

  // Hotels
  const [hotels, setHotels] = useState<HotelEntry[]>(
    (pkg?.sample_hotels as HotelEntry[]) || []
  );

  // Lists
  const [highlights, setHighlights] = useState<string[]>((pkg?.highlights as string[]) || []);
  const [inclusions, setInclusions] = useState<string[]>((pkg?.inclusions as string[]) || []);
  const [exclusions, setExclusions] = useState<string[]>((pkg?.exclusions as string[]) || []);

  // Terms
  const [terms, setTerms] = useState((pkg?.terms as string) || '');

  // Which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true, pricing: true, itinerary: true, hotels: false, lists: false, terms: false,
  });

  function toggle(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Itinerary helpers
  function addItineraryDay() {
    setItinerary(prev => [...prev, { day: prev.length + 1, title: '', description: '' }]);
  }
  function updateItineraryDay(i: number, field: keyof ItineraryDay, value: string | number) {
    setItinerary(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  }
  function removeItineraryDay(i: number) {
    setItinerary(prev => prev.filter((_, idx) => idx !== i).map((d, idx) => ({ ...d, day: idx + 1 })));
  }
  function moveDay(i: number, dir: 'up' | 'down') {
    const arr = [...itinerary];
    const t = dir === 'up' ? i - 1 : i + 1;
    if (t < 0 || t >= arr.length) return;
    [arr[i], arr[t]] = [arr[t], arr[i]];
    setItinerary(arr.map((d, idx) => ({ ...d, day: idx + 1 })));
  }

  // Hotel helpers
  function addHotel() {
    setHotels(prev => [...prev, { name: '', stars: 3, location: '', image: '', rooms: '', meals: '', bed_type: '', view: '', category: '' }]);
  }
  function updateHotel(i: number, field: keyof HotelEntry, value: string | number) {
    setHotels(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: value } : h));
  }
  function removeHotel(i: number) {
    setHotels(prev => prev.filter((_, idx) => idx !== i));
  }

  // List helpers
  function addItem(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter(prev => [...prev, '']);
  }
  function updateItem(setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, val: string) {
    setter(prev => prev.map((v, idx) => idx === i ? val : v));
  }
  function removeItem(setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) {
    setter(prev => prev.filter((_, idx) => idx !== i));
  }

  function goBack() {
    // Navigate back to the destination detail page if we know the destination
    if (destinationSlug && !isNew && pkg?.destination_slug) {
      router.back();
    } else if (destinationSlug) {
      router.push('/admin/website/destinations');
    } else {
      router.push('/admin/website/destinations');
    }
  }

  async function handleSave() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      title, slug, subtitle, destination, destination_slug: destinationSlug,
      nights: nights || null, duration_days: durationDays || null,
      cover_image: coverImage || null, published, sort_order: sortOrder,
      price_3star: price3star || null, price_4star: price4star || null,
      price_5star: price5star || null, price_from: priceFrom || price3star || null,
      price_valid_from: priceValidFrom || null, price_valid_to: priceValidTo || null,
      itinerary_days: itinerary.length > 0 ? itinerary : null,
      sample_hotels: hotels.length > 0 ? hotels : null,
      highlights: highlights.filter(Boolean),
      inclusions: inclusions.filter(Boolean),
      exclusions: exclusions.filter(Boolean),
      terms: terms || null,
    };

    try {
      if (isNew) {
        const res = await fetch('/api/website/cms/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) goBack();
      } else {
        const res = await fetch('/api/website/cms/packages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pkg!.id, ...payload }),
        });
        if (res.ok) goBack();
      }
    } finally {
      setSaving(false);
    }
  }

  // Collapsible section component
  function Section({ id, title: sectionTitle, children, badge }: {
    id: string; title: string; children: React.ReactNode; badge?: string;
  }) {
    return (
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => toggle(id)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{sectionTitle}</CardTitle>
            <div className="flex items-center gap-2">
              {badge && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{badge}</span>}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections[id] ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CardHeader>
        {openSections[id] && <CardContent className="pt-0">{children}</CardContent>}
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{isNew ? 'New Package' : title}</h1>
            {destinationSlug && (
              <p className="text-sm text-muted-foreground">Under: {destination || destinationSlug}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full">
            <Switch checked={published} onCheckedChange={setPublished} id="pkg-pub" />
            <Label htmlFor="pkg-pub" className="text-sm cursor-pointer">
              {published ? 'Published' : 'Draft'}
            </Label>
          </div>
          <Button onClick={handleSave} disabled={saving || !title}>
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Section id="basic" title="Basic Information">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Package Name *</Label>
              <Input
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (isNew) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Kashmir Honeymoon Special"
              />
            </div>
            <div>
              <Label>URL Slug *</Label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. 5 Nights / 6 Days · All Meals Included" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Nights</Label>
              <Input type="number" value={nights} onChange={e => setNights(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <Label>Total Days</Label>
              <Input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
            </div>
          </div>
          <ImagePicker value={coverImage} onChange={setCoverImage} label="Cover Image" />
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" title="Pricing">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Set per-person prices for each hotel category. The lowest price shows as the &quot;starting from&quot; price.</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>3-Star (per person)</Label>
              <Input type="number" value={price3star} onChange={e => setPrice3star(e.target.value ? Number(e.target.value) : '')} placeholder="₹" />
            </div>
            <div>
              <Label>4-Star (per person)</Label>
              <Input type="number" value={price4star} onChange={e => setPrice4star(e.target.value ? Number(e.target.value) : '')} placeholder="₹" />
            </div>
            <div>
              <Label>5-Star (per person)</Label>
              <Input type="number" value={price5star} onChange={e => setPrice5star(e.target.value ? Number(e.target.value) : '')} placeholder="₹" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Display Price (optional)</Label>
              <Input type="number" value={priceFrom} onChange={e => setPriceFrom(e.target.value ? Number(e.target.value) : '')} placeholder="Auto = 3-star price" />
            </div>
            <div>
              <Label>Valid From</Label>
              <Input type="date" value={priceValidFrom} onChange={e => setPriceValidFrom(e.target.value)} />
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input type="date" value={priceValidTo} onChange={e => setPriceValidTo(e.target.value)} />
            </div>
          </div>
        </div>
      </Section>

      {/* Itinerary */}
      <Section id="itinerary" title="Day-wise Itinerary" badge={itinerary.length > 0 ? `${itinerary.length} days` : undefined}>
        <div className="space-y-3">
          {itinerary.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">No days added yet</p>
          )}
          {itinerary.map((day, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">Day {day.day}</span>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => moveDay(i, 'up')} disabled={i === 0}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveDay(i, 'down')} disabled={i === itinerary.length - 1}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeItineraryDay(i)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </div>
              <Input
                value={day.title}
                onChange={e => updateItineraryDay(i, 'title', e.target.value)}
                placeholder="Day title, e.g. Arrival in Srinagar"
                className="font-medium"
              />
              <Textarea
                value={day.description}
                onChange={e => updateItineraryDay(i, 'description', e.target.value)}
                rows={2}
                placeholder="What happens on this day..."
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addItineraryDay} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Add Day
          </Button>
        </div>
      </Section>

      {/* Hotels */}
      <Section id="hotels" title="Sample Hotels" badge={hotels.length > 0 ? `${hotels.length} hotels` : undefined}>
        <div className="space-y-4">
          {hotels.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">No hotels added yet</p>
          )}
          {hotels.map((hotel, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Hotel {i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeHotel(i)}>
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={hotel.name} onChange={e => updateHotel(i, 'name', e.target.value)} placeholder="Hotel name" />
                </div>
                <div>
                  <Label className="text-xs">Stars</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={hotel.stars}
                    onChange={e => updateHotel(i, 'stars', Number(e.target.value))}
                  >
                    <option value={2}>2 Star</option>
                    <option value={3}>3 Star</option>
                    <option value={4}>4 Star</option>
                    <option value={5}>5 Star</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Location</Label>
                  <Input value={hotel.location} onChange={e => updateHotel(i, 'location', e.target.value)} placeholder="City / Area" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input value={hotel.category || ''} onChange={e => updateHotel(i, 'category', e.target.value)} placeholder="e.g. Boutique, Resort" />
                </div>
                <div>
                  <Label className="text-xs">Room Type</Label>
                  <Input value={hotel.rooms || ''} onChange={e => updateHotel(i, 'rooms', e.target.value)} placeholder="e.g. Deluxe, Suite" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Meals</Label>
                  <Input value={hotel.meals || ''} onChange={e => updateHotel(i, 'meals', e.target.value)} placeholder="CP / MAP / AP" />
                </div>
                <div>
                  <Label className="text-xs">Bed Type</Label>
                  <Input value={hotel.bed_type || ''} onChange={e => updateHotel(i, 'bed_type', e.target.value)} placeholder="King / Twin" />
                </div>
                <div>
                  <Label className="text-xs">View</Label>
                  <Input value={hotel.view || ''} onChange={e => updateHotel(i, 'view', e.target.value)} placeholder="Lake / Mountain" />
                </div>
              </div>
              <ImagePicker value={hotel.image} onChange={url => updateHotel(i, 'image', url)} label="Hotel Photo" />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addHotel} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Add Hotel
          </Button>
        </div>
      </Section>

      {/* Highlights, Inclusions, Exclusions */}
      <Section id="lists" title="Highlights, Inclusions & Exclusions" badge={`${highlights.length + inclusions.length + exclusions.length} items`}>
        <div className="space-y-6">
          {/* Highlights */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Highlights</Label>
              <Button variant="ghost" size="sm" onClick={() => addItem(setHighlights)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
            </div>
            {highlights.map((item, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <Input value={item} onChange={e => updateItem(setHighlights, i, e.target.value)} placeholder="e.g. Airport pickup included" />
                <Button variant="ghost" size="sm" onClick={() => removeItem(setHighlights, i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
              </div>
            ))}
          </div>

          {/* Inclusions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Inclusions (what&apos;s included)</Label>
              <Button variant="ghost" size="sm" onClick={() => addItem(setInclusions)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
            </div>
            {inclusions.map((item, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <Input value={item} onChange={e => updateItem(setInclusions, i, e.target.value)} placeholder="e.g. All meals, Hotel stay, Transfers" />
                <Button variant="ghost" size="sm" onClick={() => removeItem(setInclusions, i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
              </div>
            ))}
          </div>

          {/* Exclusions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Exclusions (what&apos;s not included)</Label>
              <Button variant="ghost" size="sm" onClick={() => addItem(setExclusions)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
            </div>
            {exclusions.map((item, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <Input value={item} onChange={e => updateItem(setExclusions, i, e.target.value)} placeholder="e.g. Flights, Personal expenses" />
                <Button variant="ghost" size="sm" onClick={() => removeItem(setExclusions, i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Terms */}
      <Section id="terms" title="Terms & Conditions">
        <Textarea
          value={terms}
          onChange={e => setTerms(e.target.value)}
          rows={6}
          placeholder="Cancellation policy, payment terms, travel insurance requirements..."
        />
      </Section>

      {/* Bottom save */}
      <div className="flex justify-between pb-8">
        <Button variant="outline" onClick={goBack}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !title}>
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Package'}
        </Button>
      </div>
    </div>
  );
}
