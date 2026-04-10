import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  // Use service role for storage upload (bypasses RLS on storage bucket)
  const serviceClient = createServiceClient();

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${id}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await serviceClient.storage
    .from('proposal-images')
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error('Cover image upload error:', JSON.stringify(uploadError));
    return NextResponse.json(
      { error: uploadError.message || 'Upload failed' },
      { status: 500 }
    );
  }

  const { data: urlData } = serviceClient.storage
    .from('proposal-images')
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
