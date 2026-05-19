'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Pencil, Trash2, FileText, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type Page = Record<string, unknown>;

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function PagesManager({ initialData }: { initialData: Page[] }) {
  const [pages, setPages] = useState<Page[]>(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  function resetForm() {
    setTitle('');
    setSlug('');
    setContent('');
    setHeroImage('');
    setSeoTitle('');
    setSeoDescription('');
    setPublished(false);
    setSortOrder(0);
  }

  function openNew() {
    setEditing(null);
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(page: Page) {
    setEditing(page);
    setTitle(page.title as string || '');
    setSlug(page.slug as string || '');
    setContent(page.content as string || '');
    setHeroImage(page.hero_image as string || '');
    setSeoTitle(page.seo_title as string || '');
    setSeoDescription(page.seo_description as string || '');
    setPublished(page.published as boolean || false);
    setSortOrder(page.sort_order as number || 0);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!title.trim() || !slug.trim()) {
      toast.error('Title and slug are required');
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      content,
      hero_image: heroImage || null,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      published,
      sort_order: sortOrder,
    };

    try {
      if (editing) {
        const res = await fetch('/api/website/cms/pages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        if (!res.ok) throw new Error('Failed to update');
        const updated = await res.json();
        setPages(prev => prev.map(p => p.id === editing.id ? updated : p));
        toast.success('Page updated');
      } else {
        const res = await fetch('/api/website/cms/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create');
        const created = await res.json();
        setPages(prev => [created, ...prev]);
        toast.success('Page created');
      }
      setSheetOpen(false);
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(page: Page) {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/website/cms/pages?id=${page.id}`, { method: 'DELETE' });
    if (res.ok) {
      setPages(prev => prev.filter(p => p.id !== page.id));
      toast.success('Page deleted');
    } else {
      toast.error('Delete failed');
    }
  }

  async function togglePublish(page: Page) {
    const newVal = !(page.published as boolean);
    const res = await fetch('/api/website/cms/pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: page.id, published: newVal }),
    });
    if (res.ok) {
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, published: newVal } : p));
      toast.success(newVal ? 'Published' : 'Unpublished');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/website">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Pages</h1>
          <Badge variant="outline">{pages.length} page{pages.length !== 1 ? 's' : ''}</Badge>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Page</Button>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pages yet. Click &quot;Add Page&quot; to create your first page.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map(page => (
                <TableRow key={page.id as string} className="cursor-pointer" onClick={() => openEdit(page)}>
                  <TableCell className="font-medium">{page.title as string}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">/{page.slug as string}</TableCell>
                  <TableCell>
                    {(page.published as boolean) ? (
                      <Badge className="bg-green-100 text-green-700 gap-1"><Eye className="h-3 w-3" /> Published</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1"><EyeOff className="h-3 w-3" /> Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{page.sort_order as number}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(page.updated_at as string).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => togglePublish(page)} title={page.published ? 'Unpublish' : 'Publish'}>
                        {(page.published as boolean) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(page)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(page)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Editor Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit Page' : 'New Page'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (!editing) setSlug(slugify(e.target.value));
                }}
                placeholder="About Us"
              />
            </div>

            <div className="space-y-2">
              <Label>Slug *</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/</span>
                <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="about-us" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hero Image URL</Label>
              <Input value={heroImage} onChange={e => setHeroImage(e.target.value)} placeholder="https://..." />
              {heroImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt="Hero preview" className="h-32 w-full object-cover rounded-md mt-2" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Content (Markdown / HTML)</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your page content here. Supports Markdown and HTML..."
                rows={20}
                className="font-mono text-sm"
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">SEO Settings</p>
              <div className="space-y-2">
                <Label>SEO Title</Label>
                <Input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Page title for search engines" />
              </div>
              <div className="space-y-2">
                <Label>SEO Description</Label>
                <Textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} placeholder="Meta description for search engines" rows={3} />
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={published} onCheckedChange={setPublished} />
                <Label>Published</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : editing ? 'Update Page' : 'Create Page'}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
