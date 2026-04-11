'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings, Save, Building2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface OrgData {
  id?: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  terms_and_conditions: string | null;
}

interface SettingsData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  agency_name: string | null;
  logo_url: string | null;
  whatsapp_number: string | null;
  default_currency: string;
  default_payment_terms: { deposit_pct: number; balance_days_before: number; notes?: string } | null;
  margin_threshold_pct: number;
  rounding_unit: number;
  tc_content: string | null;
  tc_version: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('agent');
  const [org, setOrg] = useState<OrgData>({ name: '', logo_url: null, phone: null, address: null, email: null, website: null, terms_and_conditions: null });
  const [savingOrg, setSavingOrg] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const defaultCurrency = 'INR';
  const [depositPct, setDepositPct] = useState(25);
  const [balanceDaysBefore, setBalanceDaysBefore] = useState(30);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [marginThreshold, setMarginThreshold] = useState(12);
  const [roundingUnit, setRoundingUnit] = useState('0');
  const [tcContent, setTcContent] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: SettingsData) => {
        setSettings(data);
        setFullName(data.full_name || '');
        setAgencyName(data.agency_name || '');
        setLogoUrl(data.logo_url || '');
        setWhatsappNumber(data.whatsapp_number || '');
        // currency is locked to INR
        setDepositPct(data.default_payment_terms?.deposit_pct ?? 25);
        setBalanceDaysBefore(data.default_payment_terms?.balance_days_before ?? 30);
        setPaymentNotes(data.default_payment_terms?.notes || '');
        setMarginThreshold(data.margin_threshold_pct ?? 12);
        setRoundingUnit(String(data.rounding_unit ?? 0));
        setTcContent(data.tc_content || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/settings/org')
      .then(r => r.json())
      .then((data) => {
        setUserRole(data.role || 'agent');
        if (data.org) setOrg(data.org);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        agency_name: agencyName || null,
        logo_url: logoUrl || null,
        whatsapp_number: whatsappNumber || null,
        default_currency: defaultCurrency,
        default_payment_terms: {
          deposit_pct: depositPct,
          balance_days_before: balanceDaysBefore,
          notes: paymentNotes || undefined,
        },
        margin_threshold_pct: marginThreshold,
        rounding_unit: parseInt(roundingUnit),
        tc_content: tcContent || null,
        tc_version: (settings?.tc_version || 1) + (tcContent !== settings?.tc_content ? 1 : 0),
      }),
    });

    if (res.ok) {
      toast.success('Settings saved');
    } else {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  }

  async function handleSaveOrg() {
    if (!org.name) { toast.error('Company name is required'); return; }
    setSavingOrg(true);
    const res = await fetch('/api/settings/org', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(org),
    });
    if (res.ok) {
      const data = await res.json();
      setOrg(data.org);
      toast.success('Company profile saved');
    } else {
      toast.error('Failed to save company profile');
    }
    setSavingOrg(false);
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const path = `org-logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
      if (error) { toast.error('Upload failed'); return; }
      const { data: urlData } = supabase.storage.from('org-logos').getPublicUrl(path);
      setOrg({ ...org, logo_url: urlData.publicUrl });
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Company Profile */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Company Profile</CardTitle>
            {userRole === 'super_admin' && (
              <Button size="sm" onClick={handleSaveOrg} disabled={savingOrg}>
                <Save className="h-4 w-4 mr-1" /> {savingOrg ? 'Saving...' : 'Save Company'}
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {userRole === 'super_admin' ? (
              <>
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Your company name" />
                </div>
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative inline-block">
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
                      />
                      <Button variant="outline" size="sm" className="pointer-events-none" tabIndex={-1}>
                        {uploadingLogo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload Logo
                      </Button>
                    </div>
                    {org.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logo_url} alt="Company logo" className="h-10 object-contain" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={org.phone || ''} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={org.email || ''} onChange={(e) => setOrg({ ...org, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={org.website || ''} onChange={(e) => setOrg({ ...org, website: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Address</Label>
                  <Input value={org.address || ''} onChange={(e) => setOrg({ ...org, address: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Terms &amp; Conditions (shown in PDF)</Label>
                  <Textarea
                    value={org.terms_and_conditions || ''}
                    onChange={(e) => setOrg({ ...org, terms_and_conditions: e.target.value || null })}
                    placeholder="Enter your company's terms and conditions to be printed in proposal PDFs..."
                    rows={8}
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2 grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Company:</span> {org.name || 'Not set'}</div>
                <div><span className="text-muted-foreground">Phone:</span> {org.phone || 'N/A'}</div>
                <div><span className="text-muted-foreground">Email:</span> {org.email || 'N/A'}</div>
                <div><span className="text-muted-foreground">Website:</span> {org.website || 'N/A'}</div>
                {org.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div><img src={org.logo_url} alt="Company logo" className="h-10 object-contain" /></div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agency Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Agency Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Agency Name</Label>
              <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Your travel agency name" />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
              {logoUrl && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo preview" className="h-12 object-contain" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+91XXXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Input value="INR — Indian Rupee (₹)" disabled />
              <p className="text-xs text-muted-foreground">This app operates in INR only.</p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Terms Defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Default Payment Terms</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Deposit Percentage (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={depositPct}
                onChange={(e) => setDepositPct(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Balance Due (days before departure)</Label>
              <Input
                type="number"
                min={0}
                value={balanceDaysBefore}
                onChange={(e) => setBalanceDaysBefore(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2 col-span-3">
              <Label>Payment Notes</Label>
              <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Additional payment terms notes" />
            </div>
          </CardContent>
        </Card>

        {/* Pricing Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Margin Threshold (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={marginThreshold}
                onChange={(e) => setMarginThreshold(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Alert fires if proposal margin falls below this percentage</p>
            </div>
            <div className="space-y-2">
              <Label>Rounding Unit</Label>
              <Select value={roundingUnit} onValueChange={(v) => setRoundingUnit(v ?? '0')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Off</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Grand total rounded UP to the nearest unit</p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Terms & Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Terms &amp; Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>T&amp;C Content</Label>
              <Textarea
                value={tcContent}
                onChange={(e) => setTcContent(e.target.value)}
                placeholder="Enter your agency's terms and conditions..."
                rows={12}
              />
              <p className="text-xs text-muted-foreground">
                Current version: {settings?.tc_version || 1}. Editing will auto-increment the version.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
