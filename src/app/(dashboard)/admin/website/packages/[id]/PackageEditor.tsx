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
  Save, ArrowLeft, Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
  Hotel, Calendar, Star,
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

export default function PackageEditor({ pkg }: { pkg: Pkg | null }) {
  const router = useRouter();
  const isNew = !pkg;
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [title, setTitle] = useState((pkg?.title as string) || '');
  const [slug, setSlug] = useState((pkg?.slug as string) || '');
  const [subtitle, setSubtitle] = useState((pkg?.subtitle as string) || '');
  const [destination, setDestination] = useState((pkg?.destination as string) || '');
  const [destinationSlug, setDestinationSlug] = useState((pkg?.destination_slug as string) || '');
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
  const [highlights, setHighlights] = useState<string[]>(
    (pkg?.highlights as string[]) || []
  );
  const [inclusions, setInclusions] = useState<string[]>(
    (pkg?.inclusions as string[]) || []
  );
  const [exclusions, setExclusions] = useState<string[]>(
    (pkg?.exclusions as string[]) || []
  );

  // Terms
  const [terms, setTerms] = useState((pkg?.terms as string) || '');

  function addItineraryDay() {
    setItinerary(prev => [...prev, { day: prev.length + 1, title: '', description: '' }]);
  }

  function updateItineraryDay(index: number, field: keyof ItineraryDay, value: string | number) {
    setItinerary(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  }

  function removeItineraryDay(index: number) {
    setItinerary(prev => prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, day: i + 1 })));
  }

  function moveItineraryDay(index: number, direction: 'up' | 'down') {
    const newArr = [...itinerary];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newArr.length) return;
    [newArr[index], newArr[target]] = [newArr[target], newArr[index]];
    setItinerary(newArr.map((d, i) => ({ ...d, day: i + 1 })));
  }

  function addHotel() {
    setHotels(prev => [...prev, { name: '', stars: 3, location: '', image: '', rooms: '', meals: '', bed_type: '', view: '', category: '' }]);
  }

  function updateHotel(index: number, field: keyof HotelEntry, value: string | number) {
    setHotels(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }

  function removeHotel(index: number) {
    setHotels(prev => prev.filter((_, i) => i !== index));
  }

  function addListItem(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter(prev => [...prev, '']);
  }

  function updateListItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) {
    setter(prev => prev.map((item, i) => i === index ? value : item));
  }

  function removeListItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) {
    setter(prev => prev.filter((_, i) => i !== index));
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
        if (res.ok) router.push('/admin/website/packages');
      } else {
        const res = await fetch('/api/website/cms/packages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pkg!.id, ...payload }),
        });
        if (res.ok) router.push('/admin/website/packages');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/website/packages')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{isNew ? 'New Package' : `Edit: ${title}`}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={published} onCheckedChange={setPublished} />
            <Label>Published</Label>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Package'}
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={e => {
                setTitle(e.target.value);
                if (isNew) setSlug(slugify(e.target.value));
              }} />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. 5 Nights / 6 Days" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Destination Name</Label>
              <Input value={destination} onChange={e => setDestination(e.target.value)} />
            </div>
            <div>
              <Label>Destination Slug (links to destination page)</Label>
              <Input value={destinationSlug} onChange={e => setDestinationSlug(e.target.value)} placeholder="e.g. kashmir" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Nights</Label>
              <Input type="number" value={nights} onChange={e => setNights(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <Label>Duration (days)</Label>
              <Input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
            </div>
          </div>
          <ImagePicker value={coverImage} onChange={setCoverImage} label="Cover Image" />
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Star className="h-5 w-5" /> Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>3 Star Price (per person)</Label>
              <Input type="number" value={price3star} onChange={e => setPrice3star(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <Label>4 Star Price (per person)</Label>
              <Input type="number" value={price4star} onChange={e => setPrice4star(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <Label>5 Star Price (per person)</Label>
              <Input type="number" value={price5star} onChange={e => setPrice5star(e.target.value ? Number(e.target.value) : '')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Display Price (From)</Label>
              <Input type="number" value={priceFrom} onChange={e => setPriceFrom(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <Label>Price Valid From</Label>
              <Input type="date" value={priceValidFrom} onChange={e => setPriceValidFrom(e.target.value)} />
            </div>
            <div>
              <Label>Price Valid To</Label>
              <Input type="date" value={priceValidTo} onChange={e => setPriceValidTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itinerary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Day-wise Itinerary</CardTitle>
            <Button size="sm" onClick={addItineraryDay}><Plus className="h-4 w-4 mr-1" /> Add Day</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {itinerary.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No itinerary days added yet</p>
          )}
          {itinerary.map((day, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold text-primary">Day {day.day}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => moveItineraryDay(i, 'up')} disabled={i === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveItineraryDay(i, 'down')} disabled={i === itinerary.length - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeItineraryDay(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={day.title}
                  onChange={e => updateItineraryDay(i, 'title', e.target.value)}
                  placeholder="e.g. Arrival in Srinagar"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={day.description}
                  onChange={e => updateItineraryDay(i, 'description', e.target.value)}
                  rows={3}
                  placeholder="Detailed description of this day's activities..."
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Hotels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Hotel className="h-5 w-5" /> Sample Hotels</CardTitle>
            <Button size="sm" onClick={addHotel}><Plus className="h-4 w-4 mr-1" /> Add Hotel</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hotels.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No hotels added yet</p>
          )}
          {hotels.map((hotel, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Hotel {i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeHotel(i)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Hotel Name *</Label>
                  <Input value={hotel.name} onChange={e => updateHotel(i, 'name', e.target.value)} />
                </div>
                <div>
                  <Label>Stars</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
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
                  <Label>Location</Label>
                  <Input value={hotel.location} onChange={e => updateHotel(i, 'location', e.target.value)} placeholder="e.g. Srinagar" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Input value={hotel.category || ''} onChange={e => updateHotel(i, 'category', e.target.value)} placeholder="e.g. Boutique, Heritage, Resort" />
                </div>
                <div>
                  <Label>Room Type</Label>
                  <Input value={hotel.rooms || ''} onChange={e => updateHotel(i, 'rooms', e.target.value)} placeholder="e.g. Deluxe Room, Suite" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Meals</Label>
                  <Input value={hotel.meals || ''} onChange={e => updateHotel(i, 'meals', e.target.value)} placeholder="e.g. CP, MAP, AP" />
                </div>
                <div>
                  <Label>Bed Type</Label>
                  <Input value={hotel.bed_type || ''} onChange={e => updateHotel(i, 'bed_type', e.target.value)} placeholder="e.g. King, Twin" />
                </div>
                <div>
                  <Label>View</Label>
                  <Input value={hotel.view || ''} onChange={e => updateHotel(i, 'view', e.target.value)} placeholder="e.g. Lake View, Mountain View" />
                </div>
              </div>
              <ImagePicker
                value={hotel.image}
                onChange={url => updateHotel(i, 'image', url)}
                label="Hotel Image"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Highlights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Highlights</CardTitle>
            <Button size="sm" onClick={() => addListItem(setHighlights)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {highlights.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={e => updateListItem(setHighlights, i, e.target.value)} placeholder="e.g. Airport pickup included" />
              <Button variant="ghost" size="sm" onClick={() => removeListItem(setHighlights, i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Inclusions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Inclusions</CardTitle>
            <Button size="sm" onClick={() => addListItem(setInclusions)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {inclusions.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={e => updateListItem(setInclusions, i, e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => removeListItem(setInclusions, i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Exclusions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Exclusions</CardTitle>
            <Button size="sm" onClick={() => addListItem(setExclusions)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {exclusions.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={e => updateListItem(setExclusions, i, e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => removeListItem(setExclusions, i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Terms & Conditions</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={terms}
            onChange={e => setTerms(e.target.value)}
            rows={8}
            placeholder="Enter terms and conditions, cancellation policy, payment terms..."
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Bottom save bar */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => router.push('/admin/website/packages')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Package'}
        </Button>
      </div>
    </div>
  );
}
