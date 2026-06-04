'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, List, Loader2, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface LookupItem {
  id: string;
  category: string;
  value: string;
  label: string;
  group_name: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

const CATEGORIES: { key: string; label: string; hasGroups?: boolean }[] = [
  { key: 'destination', label: 'Destinations', hasGroups: true },
  { key: 'airline', label: 'Airlines' },
  { key: 'flight_class', label: 'Flight Classes' },
  { key: 'trip_type', label: 'Trip Types' },
  { key: 'hotel_category', label: 'Hotel Categories' },
  { key: 'transfer_mode', label: 'Transfer Modes' },
  { key: 'visa_category', label: 'Visa Categories' },
  { key: 'visa_country', label: 'Visa Countries' },
  { key: 'visa_entry_type', label: 'Visa Entry Types' },
  { key: 'budget_range', label: 'Budget Ranges' },
  { key: 'lead_source', label: 'Lead Sources' },
  { key: 'food_preference', label: 'Food Preferences' },
];

interface ItemForm {
  value: string;
  label: string;
  group_name: string;
  sort_order: string;
}

const EMPTY_FORM: ItemForm = { value: '', label: '', group_name: '', sort_order: '' };

export function LookupListsSection() {
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<LookupItem | null>(null);
  const [dialogCategory, setDialogCategory] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lookup-items');
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); } else { next.add(cat); }
      return next;
    });
  };

  const openCreate = (category: string) => {
    setEditingItem(null);
    setDialogCategory(category);
    const catItems = items.filter(i => i.category === category);
    const maxOrder = catItems.reduce((m, i) => Math.max(m, i.sort_order), 0);
    setForm({ ...EMPTY_FORM, sort_order: String(maxOrder + 1) });
    setShowDialog(true);
  };

  const openEdit = (item: LookupItem) => {
    setEditingItem(item);
    setDialogCategory(item.category);
    setForm({
      value: item.value,
      label: item.label,
      group_name: item.group_name || '',
      sort_order: String(item.sort_order),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast.error('Label is required');
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        const res = await fetch('/api/lookup-items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            label: form.label.trim(),
            group_name: form.group_name.trim() || null,
            sort_order: Number(form.sort_order) || 0,
          }),
        });
        if (res.ok) {
          toast.success('Item updated');
          setShowDialog(false);
          fetchItems();
        } else {
          const err = await res.json();
          toast.error(err.error || 'Failed to update');
        }
      } else {
        const value = form.value.trim() || form.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const res = await fetch('/api/lookup-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: dialogCategory,
            value,
            label: form.label.trim(),
            group_name: form.group_name.trim() || null,
            sort_order: Number(form.sort_order) || 0,
          }),
        });
        if (res.ok) {
          toast.success('Item added');
          setShowDialog(false);
          fetchItems();
        } else {
          const err = await res.json();
          toast.error(err.error || 'Failed to add');
        }
      }
    } catch {
      toast.error('Something went wrong');
    }
    setSaving(false);
  };

  const toggleActive = async (item: LookupItem) => {
    const res = await fetch('/api/lookup-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
    });
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
    }
  };

  const deleteItem = async (item: LookupItem) => {
    const res = await fetch('/api/lookup-items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Item deleted');
    }
  };

  const catConfig = CATEGORIES.find(c => c.key === dialogCategory);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><List className="h-5 w-5" /> Lookup Lists</CardTitle>
        <p className="text-sm text-muted-foreground">Manage dropdown options used across all forms (enquiry, leads, bookings). Changes apply to both the website and the SaaS platform.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1">
            {CATEGORIES.map(cat => {
              const catItems = items.filter(i => i.category === cat.key).sort((a, b) => a.sort_order - b.sort_order);
              const isExpanded = expandedCats.has(cat.key);
              return (
                <div key={cat.key} className="border rounded-lg">
                  <button
                    onClick={() => toggleCat(cat.key)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium text-sm">{cat.label}</span>
                      <Badge variant="secondary" className="text-xs">{catItems.length}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={e => { e.stopPropagation(); openCreate(cat.key); }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-4 pb-3">
                      {catItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No items yet</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">#</TableHead>
                              <TableHead>Label</TableHead>
                              <TableHead>Value</TableHead>
                              {cat.hasGroups && <TableHead>Group</TableHead>}
                              <TableHead className="w-16">Active</TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {catItems.map(item => (
                              <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                                <TableCell className="text-xs text-muted-foreground">{item.sort_order}</TableCell>
                                <TableCell className="font-medium text-sm">{item.label}</TableCell>
                                <TableCell><code className="text-xs">{item.value}</code></TableCell>
                                {cat.hasGroups && (
                                  <TableCell>
                                    {item.group_name && <Badge variant="outline" className="text-xs">{item.group_name}</Badge>}
                                  </TableCell>
                                )}
                                <TableCell>
                                  <Switch checked={item.is_active} onCheckedChange={() => toggleActive(item)} />
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(item)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteItem(item)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} {catConfig?.label?.replace(/s$/, '') || 'Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label *</Label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Display name" />
            </div>
            {!editingItem && (
              <div>
                <Label>Value (slug)</Label>
                <Input value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="Auto-generated from label if empty" />
                <p className="text-xs text-muted-foreground mt-1">Internal identifier. Leave empty to auto-generate.</p>
              </div>
            )}
            {catConfig?.hasGroups && (
              <div>
                <Label>Group</Label>
                <Input value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} placeholder="e.g. Holiday, Pilgrimage" />
              </div>
            )}
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.label.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingItem ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
