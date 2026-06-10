import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Entity = 'clients' | 'suppliers' | 'packages';

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Bulk import for clients, suppliers and website packages.
 * The browser parses the Excel/CSV file (xlsx) and sends normalized JSON
 * rows here; this route validates, dedupes and inserts.
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: me } = await supabase.from('users').select('id, role').eq('id', authUser.id).single();
  if (!me || !['super_admin', 'manager'].includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden — imports need manager or admin role' }, { status: 403 });
  }

  const body = await req.json();
  const entity = body.entity as Entity;
  const rows = (body.rows || []) as Record<string, unknown>[];

  if (!['clients', 'suppliers', 'packages'].includes(entity)) {
    return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: 'Maximum 2000 rows per import — split the file' }, { status: 400 });
  }

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  if (entity === 'clients') {
    const { data: existing } = await supabase.from('clients').select('phone');
    const seen = new Set((existing || []).map(c => (c.phone || '').replace(/\D/g, '')));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = str(r.full_name) || str(r.name);
      const phone = str(r.phone);
      if (!name || !phone) {
        result.errors.push({ row: i + 2, message: 'name and phone are required' });
        continue;
      }
      const phoneKey = phone.replace(/\D/g, '');
      if (seen.has(phoneKey)) {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from('clients').insert({
        full_name: name,
        phone,
        email: str(r.email),
        nationality: str(r.nationality),
        notes: str(r.notes),
        created_by: me.id,
      });
      if (error) {
        result.errors.push({ row: i + 2, message: error.message });
      } else {
        seen.add(phoneKey);
        result.inserted++;
      }
    }
  }

  if (entity === 'suppliers') {
    const { data: existing } = await supabase.from('suppliers').select('name');
    const seen = new Set((existing || []).map(s => (s.name || '').toLowerCase().trim()));
    const VALID_TYPES = ['DMC', 'hotel', 'airline', 'car', 'activity', 'other'];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = str(r.name);
      if (!name) {
        result.errors.push({ row: i + 2, message: 'name is required' });
        continue;
      }
      if (seen.has(name.toLowerCase())) {
        result.skipped++;
        continue;
      }
      const rawType = str(r.type);
      const type = VALID_TYPES.find(t => t.toLowerCase() === (rawType || '').toLowerCase()) || 'other';
      const { error } = await supabase.from('suppliers').insert({
        name,
        type,
        country: str(r.country),
        contact_name: str(r.contact_name),
        contact_email: str(r.contact_email),
        contact_phone: str(r.contact_phone),
        payment_terms_days: num(r.payment_terms_days),
        notes: str(r.notes),
        created_by: me.id,
      });
      if (error) {
        result.errors.push({ row: i + 2, message: error.message });
      } else {
        seen.add(name.toLowerCase());
        result.inserted++;
      }
    }
  }

  if (entity === 'packages') {
    const { data: existing } = await supabase.from('website_packages').select('slug');
    const seen = new Set((existing || []).map(p => p.slug));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const title = str(r.title);
      if (!title) {
        result.errors.push({ row: i + 2, message: 'title is required' });
        continue;
      }
      const slug = str(r.slug) || slugify(title);
      if (seen.has(slug)) {
        result.skipped++;
        continue;
      }
      const nights = num(r.nights);
      const { error } = await supabase.from('website_packages').insert({
        slug,
        title,
        subtitle: str(r.subtitle),
        destination: str(r.destination),
        destination_slug: str(r.destination_slug),
        nights,
        duration_days: num(r.duration_days) ?? (nights != null ? nights + 1 : null),
        price_from: num(r.price_from) ?? num(r.price_3star),
        price_3star: num(r.price_3star),
        price_4star: num(r.price_4star),
        price_5star: num(r.price_5star),
        cover_image: str(r.cover_image),
        highlights: str(r.highlights) ? String(r.highlights).split(/\s*[;|]\s*/) : null,
        inclusions: str(r.inclusions) ? String(r.inclusions).split(/\s*[;|]\s*/) : null,
        exclusions: str(r.exclusions) ? String(r.exclusions).split(/\s*[;|]\s*/) : null,
        terms: str(r.terms),
        // Imported packages stay unpublished until reviewed in the CMS.
        published: false,
      });
      if (error) {
        result.errors.push({ row: i + 2, message: error.message });
      } else {
        seen.add(slug);
        result.inserted++;
      }
    }
  }

  return NextResponse.json(result);
}
