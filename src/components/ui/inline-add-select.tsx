'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Supplier inline form ────────────────────────────────────────────────────

type SupplierType = 'DMC' | 'hotel' | 'airline' | 'car' | 'activity' | 'other';

interface AddSupplierFormProps {
  type: SupplierType;
  onSaved: (supplier: { id: string; name: string }) => void;
  onCancel: () => void;
}

function AddSupplierForm({ type, onSaved, onCancel }: AddSupplierFormProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function save() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create supplier'); return; }
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 p-4 border border-blue-200 rounded-md bg-blue-50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-800">New {type.charAt(0).toUpperCase() + type.slice(1)} Supplier</p>
        <button onClick={onCancel} className="text-blue-400 hover:text-blue-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs text-gray-700">Supplier Name <span className="text-red-500">*</span></Label>
          <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Taj Hotels, Air India, Hertz" className="h-8 text-sm bg-white text-gray-900 placeholder-gray-500" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs">
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Save Supplier
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
      </div>
    </div>
  );
}

// ─── Client inline form ──────────────────────────────────────────────────────

interface AddClientFormProps {
  onSaved: (client: { id: string; full_name: string }) => void;
  onCancel: () => void;
}

function AddClientForm({ onSaved, onCancel }: AddClientFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function save() {
    if (!fullName.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create client'); return; }
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 p-4 border border-blue-200 rounded-md bg-blue-50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-800">New Client</p>
        <button onClick={onCancel} className="text-blue-400 hover:text-blue-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs text-gray-700">Name <span className="text-red-500">*</span></Label>
          <Input ref={nameRef} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Client full name" className="h-8 text-sm bg-white text-gray-900 placeholder-gray-500" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-700">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." className="h-8 text-sm bg-white text-gray-900 placeholder-gray-500" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-700">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" className="h-8 text-sm bg-white text-gray-900 placeholder-gray-500" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs">
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Save Client
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
      </div>
    </div>
  );
}

// ─── Supplier select with inline add ────────────────────────────────────────

interface SupplierSelectProps {
  type?: SupplierType;
  suppliers: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  onSupplierAdded: (supplier: { id: string; name: string }) => void;
  className?: string;
}

export function SupplierSelect({ type, suppliers, value, onChange, onSupplierAdded, className }: SupplierSelectProps) {
  const [showForm, setShowForm] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === '__add_new__') {
      setShowForm(true);
    } else {
      onChange(e.target.value);
    }
  }

  function handleSaved(supplier: { id: string; name: string }) {
    onSupplierAdded(supplier);
    onChange(supplier.id);
    setShowForm(false);
  }

  return (
    <div>
      <div className="relative">
        <select
          className={`w-full h-10 rounded-md border px-3 text-sm appearance-none pr-8 dark:bg-slate-800 dark:border-slate-600 dark:text-white ${className || ''}`}
          value={showForm ? '__add_new__' : value}
          onChange={handleChange}
        >
          <option value="" className="bg-white text-gray-900">Select supplier...</option>
          {suppliers.map(s => <option key={s.id} value={s.id} className="bg-white text-gray-900">{s.name}</option>)}
          {type && <option value="__add_new__" className="bg-white text-blue-600 font-medium">＋ Add New Supplier</option>}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-3 h-4 w-4 text-muted-foreground" />
      </div>
      {showForm && type && (
        <AddSupplierForm
          type={type}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); }}
        />
      )}
    </div>
  );
}

// ─── Client select with inline add ──────────────────────────────────────────

interface ClientSelectProps {
  clients: Array<{ id: string; full_name: string }>;
  value: string;
  onChange: (id: string) => void;
  onClientAdded: (client: { id: string; full_name: string }) => void;
  className?: string;
}

export function ClientSelect({ clients, value, onChange, onClientAdded, className }: ClientSelectProps) {
  const [showForm, setShowForm] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === '__add_new__') {
      setShowForm(true);
    } else {
      onChange(e.target.value);
    }
  }

  function handleSaved(client: { id: string; full_name: string }) {
    onClientAdded(client);
    onChange(client.id);
    setShowForm(false);
  }

  return (
    <div>
      <div className="relative">
        <select
          className={`w-full h-10 rounded-md border px-3 text-sm appearance-none pr-8 dark:bg-slate-800 dark:border-slate-600 dark:text-white ${className || ''}`}
          value={showForm ? '__add_new__' : value}
          onChange={handleChange}
        >
          <option value="" className="bg-white text-gray-900">Select client</option>
          {clients.map(c => <option key={c.id} value={c.id} className="bg-white text-gray-900">{c.full_name}</option>)}
          <option value="__add_new__" className="bg-white text-blue-600 font-medium">＋ Add New Client</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-3 h-4 w-4 text-muted-foreground" />
      </div>
      {showForm && (
        <AddClientForm
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); }}
        />
      )}
    </div>
  );
}
