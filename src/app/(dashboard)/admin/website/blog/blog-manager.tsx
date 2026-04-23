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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Sparkles, Loader2 } from 'lucide-react';

type BlogPost = Record<string, unknown>;

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  hero_image: z.string().optional(),
  tags: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  published: z.boolean().optional().default(false),
});

type FormData = z.infer<typeof schema>;

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function BlogManager({ initialData }: { initialData: BlogPost[] }) {
  const [posts, setPosts] = useState<BlogPost[]>(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiDestination, setAiDestination] = useState('');
  const [aiTone, setAiTone] = useState('informative');
  const [aiLoading, setAiLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { published: false },
  });

  function openNew() {
    setEditing(null);
    reset({ title: '', slug: '', excerpt: '', content: '', hero_image: '', tags: '', seo_title: '', seo_description: '', published: false });
    setSheetOpen(true);
  }

  function openEdit(post: BlogPost) {
    setEditing(post);
    reset({
      title: post.title as string || '',
      slug: post.slug as string || '',
      excerpt: post.excerpt as string || '',
      content: post.content as string || '',
      hero_image: post.hero_image as string || '',
      tags: ((post.tags as string[]) || []).join(', '),
      seo_title: post.seo_title as string || '',
      seo_description: post.seo_description as string || '',
      published: post.published as boolean || false,
    });
    setSheetOpen(true);
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      published_at: data.published ? new Date().toISOString() : null,
    };

    if (editing) {
      const res = await fetch('/api/website/cms/blog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === editing.id ? updated : p));
        setSheetOpen(false);
      }
    } else {
      const res = await fetch('/api/website/cms/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setPosts(prev => [created, ...prev]);
        setSheetOpen(false);
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this blog post?')) return;
    const res = await fetch(`/api/website/cms/blog?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts(prev => prev.filter(p => p.id !== id));
    }
  }

  async function generateWithAI() {
    if (!aiTopic) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/website/cms/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, destination: aiDestination, tone: aiTone }),
      });
      if (res.ok) {
        const data = await res.json();
        setValue('title', data.title || '');
        setValue('slug', slugify(data.title || ''));
        setValue('excerpt', data.excerpt || '');
        setValue('content', data.content || '');
        setValue('seo_title', data.seo_title || '');
        setValue('seo_description', data.seo_description || '');
        setValue('tags', (data.tags || []).join(', '));
        setAiDialogOpen(false);
      }
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Post</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No blog posts yet
                  </TableCell>
                </TableRow>
              ) : (
                posts.map(post => (
                  <TableRow key={post.id as string}>
                    <TableCell className="font-medium">{post.title as string}</TableCell>
                    <TableCell>
                      <Badge variant={post.published ? 'default' : 'secondary'}>
                        {post.published ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {post.published_at ? new Date(post.published_at as string).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(post)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id as string)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editor Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit Post' : 'New Post'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setAiDialogOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
              </Button>
            </div>
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
              <Label>Excerpt</Label>
              <Textarea {...register('excerpt')} rows={2} />
            </div>
            <div>
              <Label>Hero Image URL</Label>
              <Input {...register('hero_image')} />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea {...register('content')} rows={16} className="font-mono text-sm" />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input {...register('tags')} placeholder="travel, kashmir, tips" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SEO Title</Label>
                <Input {...register('seo_title')} />
              </div>
              <div>
                <Label>SEO Description</Label>
                <Input {...register('seo_description')} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={watch('published')}
                onCheckedChange={(val) => setValue('published', val)}
              />
              <Label>Published</Label>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Update' : 'Create'} Post</Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* AI Generate Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Blog Post with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Topic *</Label>
              <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Top 10 temples in South India" />
            </div>
            <div>
              <Label>Destination (optional)</Label>
              <Input value={aiDestination} onChange={(e) => setAiDestination(e.target.value)} placeholder="e.g. Tamil Nadu" />
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={aiTone} onValueChange={(val) => val && setAiTone(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="inspiring">Inspiring</SelectItem>
                  <SelectItem value="devotional">Devotional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateWithAI} disabled={aiLoading || !aiTopic} className="w-full">
              {aiLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
