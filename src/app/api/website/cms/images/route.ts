import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireApiAdmin } from '@/lib/auth/require-api-admin';

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from('website-images').list('', {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl: baseUrl } } = supabase.storage.from('website-images').getPublicUrl('');

  const images = (data || [])
    .filter(f => !f.name.startsWith('.'))
    .map(f => ({
      name: f.name,
      url: `${baseUrl}${f.name}`,
      created_at: f.created_at,
    }));

  return NextResponse.json(images);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from('website-images').upload(fileName, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from('website-images').getPublicUrl(fileName);

  return NextResponse.json({ url: publicUrl, name: fileName }, { status: 201 });
}
